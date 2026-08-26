import { describe, expect, it } from "vitest";
import { addHuman } from "../src/core/room.js";
import { RoomManager } from "../src/core/room-manager.js";
import { RoomSocketHub } from "../src/core/room-socket-hub.js";
import { WebSocketService } from "../src/core/websocket-service.js";

const fillFourPlayerRoom = (manager: RoomManager, roomId: string): void => {
  let managed = manager.create(roomId, 4);
  for (let seat = 0; seat < 4; seat += 1) {
    managed = manager.set(roomId, {
      ...managed,
      room: addHuman(managed.room, {
        id: `p${seat + 1}`,
        name: `玩家${seat + 1}`,
        seat,
      }),
    });
  }
};

describe("RoomManager", () => {
  it("creates, lists and deletes independent rooms", () => {
    const manager = new RoomManager();
    manager.create("b", 6);
    manager.create("a", 4);

    expect(manager.listRoomIds()).toEqual(["a", "b"]);
    expect(manager.delete("a")).toBe(true);
    expect(manager.listRoomIds()).toEqual(["b"]);
  });

  it("starts only a full connected room", () => {
    const manager = new RoomManager();
    fillFourPlayerRoom(manager, "ready");

    const started = manager.start("ready", () => 0.314159);
    expect(started.game.phase).toBe("playing");
    if (started.game.phase === "playing") {
      expect(started.game.hands).toHaveLength(4);
      expect(started.game.hands.every((hand) => hand.length === 27)).toBe(true);
      expect(started.game.currentTurn).toBeGreaterThanOrEqual(0);
      expect(started.game.currentTurn).toBeLessThan(4);
    }
  });
});

describe("WebSocketService", () => {
  it("parses a ping and sends a protocol response without framework coupling", async () => {
    const manager = new RoomManager();
    manager.create("socket-room", 4);
    const sent: string[] = [];
    const service = new WebSocketService(manager, new RoomSocketHub());

    await service.handleText(
      {
        send: (text) => {
          sent.push(text);
        },
      },
      { roomId: "socket-room" },
      JSON.stringify({ type: "ping", nonce: "abc" }),
    );

    expect(JSON.parse(sent[0]!)).toEqual({ type: "pong", nonce: "abc" });
  });

  it("returns a protocol error for malformed messages", async () => {
    const manager = new RoomManager();
    manager.create("socket-room", 4);
    const sent: string[] = [];
    const service = new WebSocketService(manager, new RoomSocketHub());

    await service.handleText(
      {
        send: (text) => {
          sent.push(text);
        },
      },
      { roomId: "socket-room" },
      "not-json",
    );

    const message = JSON.parse(sent[0]!);
    expect(message.type).toBe("error");
    expect(message.code).toBe("invalid_message");
  });
});
