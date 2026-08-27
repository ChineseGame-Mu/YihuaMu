import { describe, expect, it } from "vitest";
import { completeRound } from "../src/core/game-state.js";
import { addHuman } from "../src/core/room.js";
import { RoomManager } from "../src/core/room-manager.js";
import { RoomSocketHub } from "../src/core/room-socket-hub.js";
import { WebSocketService } from "../src/core/websocket-service.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const fillHumanRoom = (
  manager: RoomManager,
  roomId: string,
  playerCount: SupportedPlayerCount,
): void => {
  let managed = manager.create(roomId, playerCount);
  for (let seat = 0; seat < playerCount; seat += 1) {
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

const fillFourPlayerRoom = (manager: RoomManager, roomId: string): void => {
  fillHumanRoom(manager, roomId, 4);
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

  it("keeps seven humans on a six-player round, then expands the next round to eight", () => {
    const manager = new RoomManager();
    const roomId = "late-expand";
    const startedAt = 1_000_000;
    fillHumanRoom(manager, roomId, 6);

    let managed = manager.start(
      roomId,
      () => 0.25,
      () => startedAt,
    );
    expect(managed.game.config.playerCount).toBe(6);
    expect(managed.game.config.botCount).toBe(0);

    managed = manager.set(roomId, {
      ...managed,
      room: addHuman(
        managed.room,
        { id: "p7", name: "玩家7", seat: 6 },
        startedAt + 30 * 60 * 1000,
      ),
    });
    expect(managed.room.config.playerCount).toBe(8);
    expect(managed.room.participants).toHaveLength(7);
    expect(managed.game.config.playerCount).toBe(6);

    if (managed.game.phase !== "playing") {
      throw new Error("playing phase expected");
    }
    const firstWinner = managed.game.currentTurn;
    managed = manager.set(roomId, {
      ...managed,
      game: completeRound(managed.game, firstWinner),
    });
    managed = manager.nextRound(roomId, () => 0.25);
    expect(managed.game.config.playerCount).toBe(6);

    managed = manager.set(roomId, {
      ...managed,
      room: addHuman(
        managed.room,
        { id: "p8", name: "玩家8", seat: 7 },
        startedAt + 31 * 60 * 1000,
      ),
    });
    expect(managed.room.participants).toHaveLength(8);
    expect(managed.game.config.playerCount).toBe(6);

    if (managed.game.phase !== "playing") {
      throw new Error("playing phase expected");
    }
    const secondWinner = managed.game.currentTurn;
    managed = manager.set(roomId, {
      ...managed,
      game: completeRound(managed.game, secondWinner),
    });
    managed = manager.nextRound(roomId, () => 0.25);

    expect(managed.game.phase).toBe("playing");
    if (managed.game.phase !== "playing") {
      throw new Error("playing phase expected");
    }
    expect(managed.game.config.playerCount).toBe(8);
    expect(managed.game.config.botCount).toBe(0);
    expect(managed.game.hands).toHaveLength(8);
    expect(managed.game.hands.every((hand) => hand.length === 27)).toBe(true);
    expect(managed.game.currentTurn).toBe(secondWinner);
    expect(managed.game.trick.leaderSeat).toBe(secondWinner);
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
