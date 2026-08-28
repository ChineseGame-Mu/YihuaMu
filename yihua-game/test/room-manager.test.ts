import { describe, expect, it } from "vitest";
import { completeRound } from "../src/core/game-state.js";
import { addHuman, setReadyForNextRound } from "../src/core/room.js";
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

const addLateHumans = (
  manager: RoomManager,
  roomId: string,
  firstSeat: number,
  lastSeat: number,
  now: number,
): void => {
  let managed = manager.get(roomId);
  for (let seat = firstSeat; seat <= lastSeat; seat += 1) {
    managed = manager.set(roomId, {
      ...managed,
      room: addHuman(
        managed.room,
        { id: `p${seat + 1}`, name: `玩家${seat + 1}`, seat },
        now,
      ),
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

  it("lets late humans wait freely and expands only after both choose the next round", () => {
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
    managed = manager.set(roomId, {
      ...managed,
      room: addHuman(
        managed.room,
        { id: "p8", name: "玩家8", seat: 7 },
        startedAt + 31 * 60 * 1000,
      ),
    });
    expect(managed.room.config.playerCount).toBe(8);
    expect(managed.room.participants).toHaveLength(8);
    expect(managed.game.config.playerCount).toBe(6);

    if (managed.game.phase !== "playing") {
      throw new Error("playing phase expected");
    }
    let winner = managed.game.currentTurn;
    managed = manager.set(roomId, {
      ...managed,
      game: completeRound(managed.game, winner),
      room: setReadyForNextRound(managed.room, "p7", true),
    });
    managed = manager.nextRound(roomId, () => 0.25);
    expect(managed.game.config.playerCount).toBe(6);

    if (managed.game.phase !== "playing") {
      throw new Error("playing phase expected");
    }
    winner = managed.game.currentTurn;
    managed = manager.set(roomId, {
      ...managed,
      game: completeRound(managed.game, winner),
      room: setReadyForNextRound(managed.room, "p8", true),
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
    expect(managed.game.currentTurn).toBe(winner);
    expect(managed.game.trick.leaderSeat).toBe(winner);
  });

  it("never expands across an unready lower late-player seat", () => {
    const manager = new RoomManager();
    const roomId = "late-gap";
    const startedAt = 2_000_000;
    fillHumanRoom(manager, roomId, 6);

    let managed = manager.start(
      roomId,
      () => 0.2,
      () => startedAt,
    );
    addLateHumans(manager, roomId, 6, 11, startedAt + 60_000);
    managed = manager.get(roomId);

    for (const playerId of ["p8", "p9", "p10", "p11", "p12"]) {
      managed = manager.set(roomId, {
        ...managed,
        room: setReadyForNextRound(managed.room, playerId, true),
      });
    }

    if (managed.game.phase !== "playing") {
      throw new Error("playing phase expected");
    }
    const winner = managed.game.currentTurn;
    managed = manager.set(roomId, {
      ...managed,
      game: completeRound(managed.game, winner),
    });
    managed = manager.nextRound(roomId, () => 0.2);

    expect(managed.game.config.playerCount).toBe(6);
  });

  it("expands to the largest supported contiguous ready prefix and honors cancellation", () => {
    const manager = new RoomManager();
    const roomId = "late-prefix";
    const startedAt = 3_000_000;
    fillHumanRoom(manager, roomId, 6);

    let managed = manager.start(
      roomId,
      () => 0.3,
      () => startedAt,
    );
    addLateHumans(manager, roomId, 6, 9, startedAt + 60_000);
    managed = manager.get(roomId);

    for (const playerId of ["p7", "p8", "p9", "p10"]) {
      managed = manager.set(roomId, {
        ...managed,
        room: setReadyForNextRound(managed.room, playerId, true),
      });
    }
    managed = manager.set(roomId, {
      ...managed,
      room: setReadyForNextRound(managed.room, "p8", false),
    });

    if (managed.game.phase !== "playing") {
      throw new Error("playing phase expected");
    }
    let winner = managed.game.currentTurn;
    managed = manager.set(roomId, {
      ...managed,
      game: completeRound(managed.game, winner),
    });
    managed = manager.nextRound(roomId, () => 0.3);
    expect(managed.game.config.playerCount).toBe(6);

    managed = manager.set(roomId, {
      ...managed,
      room: setReadyForNextRound(managed.room, "p8", true),
    });
    if (managed.game.phase !== "playing") {
      throw new Error("playing phase expected");
    }
    winner = managed.game.currentTurn;
    managed = manager.set(roomId, {
      ...managed,
      game: completeRound(managed.game, winner),
    });
    managed = manager.nextRound(roomId, () => 0.3);

    expect(managed.game.config.playerCount).toBe(10);
    expect(managed.game.hands).toHaveLength(10);
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
