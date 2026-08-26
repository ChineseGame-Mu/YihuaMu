import { describe, expect, it } from "vitest";

import { parseClientMessage } from "../src/core/protocol.js";
import {
  addHuman,
  createRoom,
  disconnectHuman,
  reconnectHuman,
  removeParticipant,
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
    expect(room.participants.find(({ id }) => id === "p1")?.connected).toBe(false);

    room = reconnectHuman(room, "p1");
    expect(room.participants.find(({ id }) => id === "p1")?.connected).toBe(true);

    room = removeParticipant(room, "p2");
    expect(room.participants.map(({ id }) => id)).toEqual(["p1"]);
  });

  it("rejects duplicate seats and participant ids", () => {
    const room = addHuman(createRoom("room-2", 4), {
      id: "p1",
      name: "玩家1",
      seat: 0,
    });

    expect(() =>
      addHuman(room, { id: "p2", name: "玩家2", seat: 0 }),
    ).toThrow(/occupied/);
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
    expect(room.participants.filter(({ kind }) => kind === "robot")).toHaveLength(3);
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
    expect(() => parseClientMessage('{"type":"unknown"}')).toThrow(/unsupported/);
    expect(() => parseClientMessage('{"type":"join_room"}')).toThrow(/invalid/);
  });
});
