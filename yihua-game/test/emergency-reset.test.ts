import { describe, expect, it } from "vitest";

import { RoomManager } from "../src/core/room-manager.js";
import { addHuman, setRobotCount } from "../src/core/room.js";

describe("emergency match reset", () => {
  it("lets a live table restart from 2 while preserving seated humans and robots", () => {
    const rooms = new RoomManager();
    const roomId = "emergency-reset";
    let managed = rooms.create(roomId, 4);
    managed = rooms.set(roomId, {
      ...managed,
      room: setRobotCount(
        addHuman(managed.room, {
          id: "human-0",
          name: "真人1",
          seat: 0,
        }),
        3,
      ),
    });
    managed = rooms.start(roomId, () => 0.271828);
    if (managed.game.phase !== "playing") {
      throw new Error("playing phase expected");
    }

    managed = rooms.set(roomId, {
      ...managed,
      game: {
        ...managed.game,
        levelRank: "K",
        teamLevels: { A: "K", B: "9" },
      },
    });

    const restarted = rooms.forceRestartMatch(roomId, () => 0.314159);
    if (restarted.game.phase !== "playing") {
      throw new Error("playing phase expected after reset");
    }

    expect(restarted.game.levelRank).toBe("2");
    expect(restarted.game.teamLevels).toEqual({ A: "2", B: "2" });
    expect(restarted.game.roundNumber).toBe(1);
    expect(restarted.game.hands.every((hand) => hand.length === 27)).toBe(true);
    expect(restarted.room.participants).toHaveLength(4);
    expect(restarted.room.participants.filter(({ kind }) => kind === "robot")).toHaveLength(3);
    expect(restarted.tribute).toBeUndefined();
  });
});
