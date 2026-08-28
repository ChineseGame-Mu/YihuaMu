import { describe, expect, it } from "vitest";
import {
  completeRound,
  passGameTurn,
  playGameCards,
  startGame,
  startNextRound,
} from "../src/core/game-state.js";

const fixedRandom = () => 0.42;

describe("round-complete state guards", () => {
  it.each([4, 6, 8, 10, 12, 14] as const)(
    "rejects play/pass after completion and only resumes through next round for %i players",
    (playerCount) => {
      const playing = startGame(playerCount, fixedRandom);
      const finishOrder = Array.from(
        { length: playerCount },
        (_, seat) => seat,
      );
      const completed = completeRound(
        { ...playing, finishedSeats: finishOrder },
        finishOrder[0],
      );

      expect(completed.phase).toBe("round-complete");
      expect(() =>
        playGameCards(completed, completed.currentTurn, []),
      ).toThrow();
      expect(() => passGameTurn(completed, completed.currentTurn)).toThrow();

      const next = startNextRound(completed, fixedRandom);
      expect(next.phase).toBe("playing");
      expect(next.currentTurn).toBe(finishOrder[0]);
      expect(next.trick.leaderSeat).toBe(finishOrder[0]);
      expect(next.trick.leadingPlay).toBeNull();
      expect(next.finishedSeats).toEqual([]);
      expect(next.hands.every((hand) => hand.length === 27)).toBe(true);
      expect(next.openingDraw).toEqual(completed.openingDraw);
    },
  );
});
