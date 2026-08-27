import { describe, expect, it } from "vitest";

import { parseClientMessage } from "../src/core/protocol.js";
import {
  addHuman,
  createRoom,
  disconnectHuman,
  LATE_JOIN_WINDOW_MS,
  openLateJoinWindow,
  reconnectHuman,
  removeParticipant,
  replaceRobotWithHuman,
  roomAcceptsLateJoin,
  roomIsReady,
  setRobotCount,
} from "../src/core/room.js";

describe("independent room state", () => {
  it("tracks human seats and connection state", () => {
    let room = createRoom("room-1", 4);
    room = addHuman(room, { id: "p1", name: "玩家1", seat: 0 });
    room = addHuman(room, { id: "p2", name: "玩家2", seat: 1 });

    expect(room.participants).toHaveLength(2);
    expect(room.participants[0]?.seat).toBe(0);

    room = disconnectHuman(room, "p1");
    expect(room.participants.find(({ id }) => id === "p1")?.connected).toBe(
      false,
    );

    room = reconnectHuman(room, "p1");
    expect(room.participants.find(({ id }) => id === "p1")?.connected).toBe(
      true,
    );

    room = removeParticipant(room, "p2");
    expect(room.participants.map(({ id }) => id)).toEqual(["p1"]);
  });

  it("rejects duplicate seats and participant ids", () => {
    const room = addHuman(createRoom("room-2", 4), {
      id: "p1",
      name: "玩家1",
      seat: 0,
    });

    expect(() => addHuman(room, { id: "p2", name: "玩家2", seat: 0 })).toThrow(
      /occupied/,
    );
    expect(() =>
      addHuman(room, { id: "p1", name: "玩家1-重复", seat: 1 }),
    ).toThrow(/already exists/);
  });

  it("adds one to three robots into free seats without displacing humans", () => {
    let room = createRoom("room-3", 6);
    room = addHuman(room, { id: "p1", name: "玩家1", seat: 0 });
    room = addHuman(room, { id: "p2", name: "玩家2", seat: 3 });
    room = setRobotCount(room, 3);

    expect(room.config.botCount).toBe(3);
    expect(
      room.participants.filter(({ kind }) => kind === "robot"),
    ).toHaveLength(3);
    expect(room.participants.find(({ id }) => id === "p1")?.seat).toBe(0);
    expect(room.participants.find(({ id }) => id === "p2")?.seat).toBe(3);
    expect(new Set(room.participants.map(({ seat }) => seat)).size).toBe(
      room.participants.length,
    );
  });

  it("reports ready only when every table seat is occupied and connected", () => {
    let room = createRoom("room-4", 4);
    room = addHuman(room, { id: "p1", name: "玩家1", seat: 0 });
    room = addHuman(room, { id: "p2", name: "玩家2", seat: 1 });
    room = setRobotCount(room, 2);
    expect(roomIsReady(room)).toBe(true);

    room = disconnectHuman(room, "p1");
    expect(roomIsReady(room)).toBe(false);
  });

  it("starts the three-hour late-join clock when play begins", () => {
    const startedAt = 1_000_000;
    const lobbyRoom = createRoom("late-room", 4);
    expect(lobbyRoom.joinClosesAt).toBeUndefined();
    expect(
      roomAcceptsLateJoin(lobbyRoom, startedAt + 10 * LATE_JOIN_WINDOW_MS),
    ).toBe(true);

    const room = openLateJoinWindow(lobbyRoom, startedAt);
    expect(room.joinClosesAt).toBe(startedAt + LATE_JOIN_WINDOW_MS);
    expect(roomAcceptsLateJoin(room, startedAt + LATE_JOIN_WINDOW_MS)).toBe(
      true,
    );
    expect(roomAcceptsLateJoin(room, startedAt + LATE_JOIN_WINDOW_MS + 1)).toBe(
      false,
    );
    expect(() =>
      addHuman(
        room,
        { id: "late", name: "后到玩家", seat: 0 },
        startedAt + LATE_JOIN_WINDOW_MS + 1,
      ),
    ).toThrow(/three-hour join window/);
  });

  it("lets a late human take over a robot seat without changing the seat", () => {
    const startedAt = 2_000_000;
    let room = createRoom("late-robot", 4);
    room = addHuman(room, { id: "p1", name: "玩家1", seat: 0 }, startedAt);
    room = setRobotCount(room, 3);
    room = openLateJoinWindow(room, startedAt);
    const robotSeat = room.participants.find(
      ({ kind }) => kind === "robot",
    )?.seat;
    if (robotSeat === undefined) throw new Error("robot seat expected");

    room = replaceRobotWithHuman(
      room,
      { id: "late", name: "后到玩家", seat: robotSeat },
      startedAt + 60 * 60 * 1000,
    );

    expect(room.participants.find(({ id }) => id === "late")?.seat).toBe(
      robotSeat,
    );
    expect(room.participants.find(({ seat }) => seat === robotSeat)?.kind).toBe(
      "human",
    );
    expect(room.config.botCount).toBe(2);
    expect(room.participants).toHaveLength(4);
  });
});

describe("independent room protocol", () => {
  it("parses join_room and robot configuration messages", () => {
    expect(
      parseClientMessage(
        JSON.stringify({
          type: "join_room",
          roomId: "0001",
          playerId: "p1",
          name: "玩家1",
          seat: 0,
        }),
      ),
    ).toEqual({
      type: "join_room",
      roomId: "0001",
      playerId: "p1",
      name: "玩家1",
      seat: 0,
    });

    expect(parseClientMessage('{"type":"set_robots","count":3}')).toEqual({
      type: "set_robots",
      count: 3,
    });
  });

  it("rejects unknown or malformed messages", () => {
    expect(() => parseClientMessage('{"type":"unknown"}')).toThrow(
      /unsupported/,
    );
    expect(() => parseClientMessage('{"type":"join_room"}')).toThrow(/invalid/);
  });
});
