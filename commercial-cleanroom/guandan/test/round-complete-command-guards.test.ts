import { describe, expect, it } from "vitest";
import { transitionGame } from "../src/core/game-machine.js";
import {
  completeRound,
  createLobbyState,
  startGame,
} from "../src/core/game-state.js";

const fixedRandom = () => 0.42;

describe("round-complete state guards", () => {
  it.each([4, 6, 8, 10, 12, 14] as const)(
    "rejects play/pass after completion and only resumes through next round for %i players",
    (playerCount) => {
      const playing = startGame(createLobbyState(playerCount, 0), fixedRandom);
      const finishOrder = Array.from(
        { length: playerCount },
        (_, seat) => seat,
      );
      const winnerSeat = finishOrder[0]!;
      const completed = completeRound(
        { ...playing, finishedSeats: finishOrder },
        winnerSeat,
      );

      expect(completed.phase).toBe("round-complete");
      expect(() =>
        transitionGame(completed, {
          type: "play-cards",
          seat: completed.currentTurn,
          cards: [],
        }),
      ).toThrow("cannot play-cards while game is round-complete");
      expect(() =>
        transitionGame(completed, {
          type: "pass-turn",
          seat: completed.currentTurn,
        }),
      ).toThrow("cannot pass-turn while game is round-complete");

      const next = transitionGame(
        completed,
        { type: "next-round" },
        fixedRandom,
      );
      expect(next.phase).toBe("playing");
      if (next.phase !== "playing") {
        throw new Error("playing phase expected");
      }
      expect(next.currentTurn).toBe(winnerSeat);
      expect(next.trick.leaderSeat).toBe(winnerSeat);
      expect(next.trick.leadingPlay).toBeNull();
      expect(next.finishedSeats).toEqual([]);
      expect(next.hands.every((hand) => hand.length === 27)).toBe(true);
      expect(next.openingDraw).toEqual(completed.openingDraw);
    },
  );
});
