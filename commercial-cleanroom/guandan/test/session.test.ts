import { describe, expect, it } from "vitest";

import { createRoom } from "../src/core/room.js";
import { applyClientMessage } from "../src/core/session.js";

describe("independent room session reducer", () => {
  it("applies join, robot configuration, ping, and leave messages", () => {
    let room = createRoom("0001", 4);

    let result = applyClientMessage(room, {
      type: "join_room",
      roomId: "0001",
      playerId: "p1",
      name: "玩家1",
      seat: 0,
    });
    room = result.room;
    expect(result.response.type).toBe("room_state");
    expect(room.participants.map(({ id }) => id)).toEqual(["p1"]);

    result = applyClientMessage(room, { type: "set_robots", count: 3 });
    room = result.room;
    expect(room.participants).toHaveLength(4);
    expect(room.config.botCount).toBe(3);

    result = applyClientMessage(room, { type: "ping", nonce: "abc" });
    expect(result.response).toEqual({ type: "pong", nonce: "abc" });

    result = applyClientMessage(room, { type: "leave_room", playerId: "p1" });
    expect(result.room.participants.some(({ id }) => id === "p1")).toBe(false);
  });

  it("rejects join messages targeting another room", () => {
    const room = createRoom("0001", 4);
    expect(() =>
      applyClientMessage(room, {
        type: "join_room",
        roomId: "9999",
        playerId: "p1",
        name: "玩家1",
        seat: 0,
      }),
    ).toThrow(/does not match/);
  });
});
