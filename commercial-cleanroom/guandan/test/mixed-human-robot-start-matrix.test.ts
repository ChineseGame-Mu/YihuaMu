import { describe, expect, it } from "vitest";
import { RoomManager } from "../src/core/room-manager.js";
import { addHuman, setRobotCount } from "../src/core/room.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

describe("mixed human/robot table start matrix", () => {
  for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
    it(`starts ${playerCount} seats with three robots and deals 27 cards per seat`, () => {
      const manager = new RoomManager();
      const roomId = `mixed-${playerCount}`;
      let managed = manager.create(roomId, playerCount);
      const humanCount = playerCount - 3;

      for (let seat = 0; seat < humanCount; seat += 1) {
        managed = manager.set(roomId, {
          ...managed,
          room: addHuman(managed.room, {
            id: `human-${seat}`,
            name: `玩家${seat + 1}`,
            seat,
          }),
        });
      }

      managed = manager.set(roomId, {
        ...managed,
        room: setRobotCount(managed.room, 3),
      });

      expect(managed.room.participants).toHaveLength(playerCount);
      expect(
        managed.room.participants.filter(({ kind }) => kind === "robot"),
      ).toHaveLength(3);

      const started = manager.start(roomId, () => 0.314159);
      expect(started.game.phase).toBe("playing");
      expect(started.game.config.playerCount).toBe(playerCount);
      expect(started.game.config.botCount).toBe(3);

      if (started.game.phase !== "playing") {
        throw new Error("playing phase expected");
      }
      expect(started.game.hands).toHaveLength(playerCount);
      expect(started.game.hands.every((hand) => hand.length === 27)).toBe(true);
      expect(started.game.currentTurn).toBeGreaterThanOrEqual(0);
      expect(started.game.currentTurn).toBeLessThan(playerCount);
    });
  }
});
