import { describe, expect, it } from "vitest";

import { completeRound } from "../src/core/game-state.js";
import { attachLegacyGuandanConnection } from "../src/core/legacy-guandan-gateway.js";
import { createServerRuntime } from "../src/core/server-runtime.js";
import type {
  ConnectionContext,
  TextSocket,
} from "../src/core/websocket-service.js";
import type { UpgradedConnection } from "../src/core/websocket-upgrade.js";

class RecordingSocket implements TextSocket {
  readonly sent: string[] = [];
  send(text: string): void {
    this.sent.push(text);
  }
}

class FakeConnection implements UpgradedConnection {
  readonly socket = new RecordingSocket();
  private textHandler: ((text: string) => void | Promise<void>) | undefined;
  private closeHandler: (() => void | Promise<void>) | undefined;

  constructor(readonly context: ConnectionContext) {}

  onText(handler: (text: string) => void | Promise<void>): void {
    this.textHandler = handler;
  }

  onClose(handler: () => void | Promise<void>): void {
    this.closeHandler = handler;
  }

  async receive(message: unknown): Promise<void> {
    await this.textHandler?.(JSON.stringify(message));
  }
}

const messages = (connection: FakeConnection): any[] =>
  connection.socket.sent.map((text) => JSON.parse(text));

describe("legacy spectator next-round entry", () => {
  it("moves the requesting player one seat left or right before the first round", async () => {
    const runtime = createServerRuntime();
    const roomId = "seat-arrow-movement";
    const connections: FakeConnection[] = [];
    for (let seat = 0; seat < 4; seat += 1) {
      const connection = new FakeConnection({ roomId });
      await attachLegacyGuandanConnection(runtime, connection);
      await connection.receive({
        type: "join",
        room: roomId,
        name: `换位玩家${seat + 1}`,
        player_count: 4,
      });
      connections.push(connection);
    }

    await connections[0]!.receive({ type: "move_seat", direction: "right" });
    expect(
      runtime.rooms
        .get(roomId)
        .room.participants.find(({ name }) => name === "换位玩家1")?.seat,
    ).toBe(1);
    expect(
      messages(connections[0]!)
        .filter(({ type }) => type === "joined")
        .at(-1)?.seat,
    ).toBe(1);

    await connections[0]!.receive({ type: "move_seat", direction: "left" });
    expect(
      runtime.rooms
        .get(roomId)
        .room.participants.find(({ name }) => name === "换位玩家1")?.seat,
    ).toBe(0);
  });

  it("keeps a late arrival observing, then seats them with their optional partner for the next round", async () => {
    const runtime = createServerRuntime();
    const roomId = "spectator-entry";
    const player = new FakeConnection({ roomId });
    await attachLegacyGuandanConnection(runtime, player);
    await player.receive({
      type: "join",
      room: roomId,
      name: "玩家1",
      player_count: 4,
    });
    await player.receive({ type: "set_bots", count: 3 });
    await player.receive({ type: "start", player_count: 4 });

    const observer = new FakeConnection({ roomId });
    await attachLegacyGuandanConnection(runtime, observer);
    await observer.receive({
      type: "join",
      room: roomId,
      name: "后来者",
      player_count: 4,
    });

    expect(
      messages(observer)
        .filter(({ type }) => type === "joined")
        .at(-1),
    ).toMatchObject({
      seat: null,
    });
    expect(
      runtime.rooms.get(roomId).room.observers.map(({ name }) => name),
    ).toEqual(["后来者"]);

    await observer.receive({
      type: "set_participation",
      active: true,
      preferred_partner: "玩家1",
    });
    expect(runtime.rooms.get(roomId).room.observers[0]?.readyForNextRound).toBe(
      true,
    );

    let managed = runtime.rooms.get(roomId);
    if (managed.game.phase !== "playing")
      throw new Error("playing phase expected");
    managed = runtime.rooms.set(roomId, {
      ...managed,
      game: completeRound(managed.game, managed.game.currentTurn),
    });
    managed = runtime.rooms.nextRound(roomId, () => 0.25);
    await runtime.websocket.broadcastRoomState(managed);
    await runtime.websocket.broadcastGameState(managed);
    await runtime.websocket.sendPrivateHands(managed);

    const joined = messages(observer)
      .filter(({ type }) => type === "joined")
      .at(-1);
    expect(joined.seat).toBe(2);
    expect(
      runtime.rooms
        .get(roomId)
        .room.participants.find(({ name }) => name === "后来者"),
    ).toMatchObject({ kind: "human", seat: 2 });
    expect(
      messages(observer)
        .filter(({ type }) => type === "hand")
        .at(-1).cards,
    ).toHaveLength(27);
  });

  it("turns a departing seated player into an observer and installs a robot at the same seat", async () => {
    const runtime = createServerRuntime();
    const roomId = "player-exit";
    const connections: FakeConnection[] = [];
    for (let seat = 0; seat < 4; seat += 1) {
      const connection = new FakeConnection({ roomId });
      await attachLegacyGuandanConnection(runtime, connection);
      await connection.receive({
        type: "join",
        room: roomId,
        name: `玩家${seat + 1}`,
        player_count: 4,
      });
      connections.push(connection);
    }
    await connections[0]!.receive({ type: "start", player_count: 4 });
    await connections[2]!.receive({ type: "set_participation", active: false });

    let managed = runtime.rooms.get(roomId);
    expect(
      managed.room.participants.find(({ id }) => id === "legacy:玩家3")
        ?.leavingAfterRound,
    ).toBe(true);
    if (managed.game.phase !== "playing")
      throw new Error("playing phase expected");
    managed = runtime.rooms.set(roomId, {
      ...managed,
      game: completeRound(managed.game, managed.game.currentTurn),
    });
    managed = runtime.rooms.nextRound(roomId, () => 0.25);
    await runtime.websocket.broadcastRoomState(managed);
    await runtime.websocket.broadcastGameState(managed);
    await runtime.websocket.sendPrivateHands(managed);

    expect(
      managed.room.participants.find(({ seat }) => seat === 2),
    ).toMatchObject({
      kind: "robot",
    });
    expect(
      managed.room.observers.find(({ id }) => id === "legacy:玩家3"),
    ).toMatchObject({
      name: "玩家3",
      readyForNextRound: false,
    });
    expect(
      messages(connections[2]!)
        .filter(({ type }) => type === "joined")
        .at(-1),
    ).toMatchObject({ seat: null });
  });
});
