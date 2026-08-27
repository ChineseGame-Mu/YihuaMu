import { describe, expect, it } from "vitest";

import { parseClientMessage } from "../src/core/protocol.js";
import {
  addHuman,
  createRoom,
  disconnectHuman,
  reconnectHuman,
  setRobotCount,
} from "../src/core/room.js";
import { RoomManager } from "../src/core/room-manager.js";
import { RoomSocketHub } from "../src/core/room-socket-hub.js";
import { createServerRuntime } from "../src/core/server-runtime.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";
import {
  type ConnectionContext,
  WebSocketService,
  type TextSocket,
} from "../src/core/websocket-service.js";
import {
  attachUpgradedConnection,
  type UpgradedConnection,
} from "../src/core/websocket-upgrade.js";

class RecordingSocket implements TextSocket {
  readonly sent: string[] = [];

  send(text: string): void {
    this.sent.push(text);
  }
}

class FakeUpgradedConnection implements UpgradedConnection {
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

  async receive(text: string): Promise<void> {
    await this.textHandler?.(text);
  }

  async triggerClose(): Promise<void> {
    await this.closeHandler?.();
  }
}

const deterministicRandom = (): (() => number) => {
  let state = 0x12345678;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

describe("command concurrency guards", () => {
  it("parses revision and command id metadata", () => {
    expect(
      parseClientMessage(
        JSON.stringify({
          type: "set_robots",
          count: 2,
          expectedRevision: 7,
          commandId: " robots-7 ",
        }),
      ),
    ).toEqual({
      type: "set_robots",
      count: 2,
      expectedRevision: 7,
      commandId: "robots-7",
    });
  });

  it("rejects stale revisions without changing room state", async () => {
    const rooms = new RoomManager();
    const hub = new RoomSocketHub();
    const service = new WebSocketService(rooms, hub);
    const socket = new RecordingSocket();
    rooms.create("stale-room", 4);

    await service.handleText(
      socket,
      { roomId: "stale-room", playerId: "p1" },
      JSON.stringify({
        type: "join_room",
        roomId: "stale-room",
        playerId: "p1",
        name: "玩家1",
        seat: 0,
        expectedRevision: 0,
        commandId: "join-1",
      }),
    );

    const before = rooms.get("stale-room");
    expect(before.revision).toBe(1);

    const after = await service.handleText(
      socket,
      { roomId: "stale-room", playerId: "p1" },
      JSON.stringify({
        type: "set_robots",
        count: 1,
        expectedRevision: 0,
        commandId: "robots-stale",
      }),
    );

    expect(after).toBe(before);
    expect(after.revision).toBe(1);
    expect(after.room.config.botCount).toBe(0);
    expect(JSON.parse(socket.sent.at(-1) ?? "{}")).toMatchObject({
      type: "error",
      code: "stale_revision",
    });
  });

  it("treats a repeated command id as an idempotent retry", async () => {
    const rooms = new RoomManager();
    const hub = new RoomSocketHub();
    const service = new WebSocketService(rooms, hub);
    const socket = new RecordingSocket();
    rooms.create("retry-room", 4);

    const raw = JSON.stringify({
      type: "join_room",
      roomId: "retry-room",
      playerId: "p1",
      name: "玩家1",
      seat: 0,
      expectedRevision: 0,
      commandId: "join-once",
    });

    const first = await service.handleText(
      socket,
      { roomId: "retry-room", playerId: "p1" },
      raw,
    );
    const second = await service.handleText(
      socket,
      { roomId: "retry-room", playerId: "p1" },
      raw,
    );

    expect(first.revision).toBe(1);
    expect(second.revision).toBe(1);
    expect(second.room.participants).toHaveLength(1);
    expect(JSON.parse(socket.sent.at(-1) ?? "{}")).toMatchObject({
      type: "room_state",
      revision: 1,
    });
  });
});

describe("4–14 player reconnect stress", () => {
  it("preserves seats and socket counts through repeated reconnect cycles", () => {
    for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
      let room = createRoom(`stress-${playerCount}`, playerCount);
      const hub = new RoomSocketHub();
      const sockets = Array.from(
        { length: playerCount },
        () => new RecordingSocket(),
      );

      for (let seat = 0; seat < playerCount; seat += 1) {
        room = addHuman(room, {
          id: `p${seat}`,
          name: `玩家${seat + 1}`,
          seat,
        });
        hub.register(room.roomId, sockets[seat]!, `p${seat}`);
      }

      expect(hub.count(room.roomId)).toBe(playerCount);

      for (let cycle = 0; cycle < 25; cycle += 1) {
        for (let seat = 0; seat < playerCount; seat += 1) {
          const playerId = `p${seat}`;
          const socket = sockets[seat]!;
          room = disconnectHuman(room, playerId);
          hub.unregister(room.roomId, socket);
          expect(hub.playerConnectionCount(room.roomId, playerId)).toBe(0);

          room = reconnectHuman(room, playerId);
          hub.register(room.roomId, socket, playerId);
          expect(hub.playerConnectionCount(room.roomId, playerId)).toBe(1);
        }
      }

      expect(hub.count(room.roomId)).toBe(playerCount);
      expect(room.participants).toHaveLength(playerCount);
      expect(room.participants.every(({ connected }) => connected)).toBe(true);
      expect(room.participants.map(({ seat }) => seat)).toEqual(
        Array.from({ length: playerCount }, (_, seat) => seat),
      );
    }
  });

  it("keeps a player online until their final socket closes", async () => {
    const runtime = createServerRuntime();
    const managed = runtime.rooms.create("multi-socket", 4);
    runtime.rooms.set("multi-socket", {
      ...managed,
      room: addHuman(managed.room, {
        id: "p1",
        name: "玩家1",
        seat: 0,
      }),
    });

    const first = new FakeUpgradedConnection({
      roomId: "multi-socket",
      playerId: "p1",
    });
    const second = new FakeUpgradedConnection({
      roomId: "multi-socket",
      playerId: "p1",
    });

    await attachUpgradedConnection(runtime, first);
    await attachUpgradedConnection(runtime, second);
    expect(runtime.sockets.playerConnectionCount("multi-socket", "p1")).toBe(2);

    await first.triggerClose();
    expect(runtime.sockets.playerConnectionCount("multi-socket", "p1")).toBe(1);
    expect(
      runtime.rooms.get("multi-socket").room.participants[0]?.connected,
    ).toBe(true);

    await second.triggerClose();
    expect(runtime.sockets.playerConnectionCount("multi-socket", "p1")).toBe(0);
    expect(
      runtime.rooms.get("multi-socket").room.participants[0]?.connected,
    ).toBe(false);

    const reconnected = new FakeUpgradedConnection({
      roomId: "multi-socket",
      playerId: "p1",
    });
    await attachUpgradedConnection(runtime, reconnected);
    expect(runtime.sockets.playerConnectionCount("multi-socket", "p1")).toBe(1);
    expect(
      runtime.rooms.get("multi-socket").room.participants[0]?.connected,
    ).toBe(true);
  });

  it("preserves active game state and sends one revision on reconnect", async () => {
    const runtime = createServerRuntime();
    const created = runtime.rooms.create("playing-reconnect", 4);
    const withHuman = runtime.rooms.set("playing-reconnect", {
      ...created,
      room: addHuman(created.room, {
        id: "p1",
        name: "玩家1",
        seat: 0,
      }),
    });
    runtime.rooms.set("playing-reconnect", {
      ...withHuman,
      room: setRobotCount(withHuman.room, 3),
    });
    const started = runtime.rooms.start(
      "playing-reconnect",
      deterministicRandom(),
    );
    expect(started.game.phase).toBe("playing");
    if (started.game.phase !== "playing") return;

    const baseline = {
      currentTurn: started.game.currentTurn,
      handCounts: started.game.hands.map((hand) => hand.length),
      completedTricks: started.game.trick.completedTricks,
    };

    const first = new FakeUpgradedConnection({
      roomId: "playing-reconnect",
      playerId: "p1",
    });
    await attachUpgradedConnection(runtime, first);
    await first.triggerClose();

    const disconnected = runtime.rooms.get("playing-reconnect");
    expect(disconnected.game.phase).toBe("playing");
    if (disconnected.game.phase !== "playing") return;
    expect(disconnected.game.currentTurn).toBe(baseline.currentTurn);
    expect(disconnected.game.hands.map((hand) => hand.length)).toEqual(
      baseline.handCounts,
    );
    expect(disconnected.game.trick.completedTricks).toBe(
      baseline.completedTricks,
    );

    const reconnected = new FakeUpgradedConnection({
      roomId: "playing-reconnect",
      playerId: "p1",
    });
    await attachUpgradedConnection(runtime, reconnected);

    const current = runtime.rooms.get("playing-reconnect");
    const snapshots = reconnected.socket.sent.map((text) => JSON.parse(text));
    const roomState = snapshots.find(({ type }) => type === "room_state");
    const gameState = snapshots.find(({ type }) => type === "game_state");
    const privateHand = snapshots.find(({ type }) => type === "private_hand");

    expect(roomState?.revision).toBe(current.revision);
    expect(gameState?.revision).toBe(current.revision);
    expect(privateHand?.revision).toBe(current.revision);
    expect(gameState).toMatchObject(baseline);
    expect(privateHand?.cards).toHaveLength(baseline.handCounts[0] ?? 0);
  });
});
