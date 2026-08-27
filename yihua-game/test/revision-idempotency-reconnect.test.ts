import { describe, expect, it } from "vitest";

import { parseClientMessage } from "../src/core/protocol.js";
import {
  addHuman,
  createRoom,
  disconnectHuman,
  reconnectHuman,
} from "../src/core/room.js";
import { RoomManager } from "../src/core/room-manager.js";
import { RoomSocketHub } from "../src/core/room-socket-hub.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";
import {
  WebSocketService,
  type TextSocket,
} from "../src/core/websocket-service.js";

class RecordingSocket implements TextSocket {
  readonly sent: string[] = [];

  send(text: string): void {
    this.sent.push(text);
  }
}

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
});
