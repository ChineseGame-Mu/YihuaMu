import { describe, expect, it } from "vitest";
import { createServerRuntime } from "../src/core/server-runtime.js";
import type {
  ConnectionContext,
  TextSocket,
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

  latest(type: string): Record<string, unknown> | undefined {
    return this.sent
      .map((message) => JSON.parse(message) as Record<string, unknown>)
      .reverse()
      .find((message) => message.type === type);
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

  async receive(text: string): Promise<void> {
    await this.textHandler?.(text);
  }

  async close(): Promise<void> {
    await this.closeHandler?.();
  }
}

const roomParticipants = (
  message: Record<string, unknown> | undefined,
): readonly Record<string, unknown>[] => {
  const participants = message?.participants;
  if (!Array.isArray(participants)) return [];
  return participants as readonly Record<string, unknown>[];
};

describe("14-client websocket room acceptance", () => {
  it("synchronizes 14 humans, rejects the 15th, and recovers a disconnected client", async () => {
    const runtime = createServerRuntime();
    const roomId = "acceptance-14";
    runtime.rooms.create(roomId, 14);

    const clients = Array.from({ length: 14 }, (_, seat) =>
      new FakeConnection({ roomId, playerId: `p${seat + 1}` }),
    );

    for (const [seat, client] of clients.entries()) {
      await attachUpgradedConnection(runtime, client);
      const playerId = client.context.playerId!;
      await client.receive(
        JSON.stringify({
          type: "join_room",
          roomId,
          playerId,
          name: `Player ${seat + 1}`,
          seat,
        }),
      );
    }

    expect(runtime.sockets.count(roomId)).toBe(14);
    const room = runtime.rooms.get(roomId).room;
    expect(room.config.playerCount).toBe(14);
    expect(room.participants).toHaveLength(14);
    expect(room.participants.every(({ kind }) => kind === "human")).toBe(true);
    expect(new Set(room.participants.map(({ id }) => id)).size).toBe(14);
    expect(new Set(room.participants.map(({ seat }) => seat)).size).toBe(14);
    expect(room.participants.map(({ seat }) => seat).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 14 }, (_, seat) => seat),
    );

    for (const client of clients) {
      const state = client.socket.latest("room_state");
      expect(state?.playerCount).toBe(14);
      expect(roomParticipants(state)).toHaveLength(14);
      expect(
        new Set(roomParticipants(state).map(({ id }) => id)).size,
      ).toBe(14);
    }

    const fifteenth = new FakeConnection({ roomId, playerId: "p15" });
    await attachUpgradedConnection(runtime, fifteenth);
    await fifteenth.receive(
      JSON.stringify({
        type: "join_room",
        roomId,
        playerId: "p15",
        name: "Player 15",
        seat: 14,
      }),
    );

    expect(fifteenth.socket.latest("error")).toMatchObject({
      type: "error",
      code: "invalid_message",
    });
    expect(String(fifteenth.socket.latest("error")?.message)).toMatch(
      /14-player maximum/,
    );
    expect(runtime.rooms.get(roomId).room.participants).toHaveLength(14);
    await fifteenth.close();
    expect(runtime.sockets.count(roomId)).toBe(14);

    const reconnectIndex = 6;
    const disconnected = clients[reconnectIndex]!;
    const playerId = disconnected.context.playerId!;
    await disconnected.close();
    expect(runtime.sockets.count(roomId)).toBe(13);
    expect(
      runtime.rooms
        .get(roomId)
        .room.participants.find(({ id }) => id === playerId)?.connected,
    ).toBe(false);

    const reconnected = new FakeConnection({ roomId, playerId });
    await attachUpgradedConnection(runtime, reconnected);
    expect(runtime.sockets.count(roomId)).toBe(14);
    expect(runtime.sockets.playerConnectionCount(roomId, playerId)).toBe(1);
    expect(
      runtime.rooms
        .get(roomId)
        .room.participants.find(({ id }) => id === playerId)?.connected,
    ).toBe(true);
    expect(roomParticipants(reconnected.socket.latest("room_state"))).toHaveLength(
      14,
    );
  });
});
