import { describe, expect, it } from "vitest";
import { completeRound, createLobbyState, startGame, startNextRound } from "../src/core/game-state.js";

const fixedRandom = () => 0.42;

describe("round completion to next-round lifecycle", () => {
  it.each([4, 6, 8, 10, 12, 14])(
    "preserves full placement order and lets first place lead the next %i-player round",
    (playerCount) => {
      const playing = startGame(createLobbyState(playerCount, 0), fixedRandom);
      const finishOrder = Array.from({ length: playerCount }, (_, seat) => (seat + 1) % playerCount);
      const firstPlaceSeat = finishOrder[0]!;
      const completed = completeRound(
        { ...playing, finishedSeats: finishOrder },
        firstPlaceSeat,
      );

      expect(completed.phase).toBe("round-complete");
      expect(completed.finishedSeats).toEqual(finishOrder);
      expect(completed.placements).toHaveLength(playerCount);
      expect(completed.outcome?.firstPlaceSeat).toBe(firstPlaceSeat);

      const next = startNextRound(completed, fixedRandom);
      expect(next.phase).toBe("playing");
      expect(next.currentTurn).toBe(firstPlaceSeat);
      expect(next.trick.leaderSeat).toBe(firstPlaceSeat);
      expect(next.trick.leadingPlay).toBeNull();
      expect(next.finishedSeats).toEqual([]);
      expect(next.hands).toHaveLength(playerCount);
      expect(next.hands.every((hand) => hand.length === 27)).toBe(true);
      expect(next.openingDraw).toEqual(completed.openingDraw);
    },
  );

  it("rejects a declared winner that disagrees with first place", () => {
    const playing = startGame(createLobbyState(4, 0), fixedRandom);
    expect(() =>
      completeRound({ ...playing, finishedSeats: [2, 0, 1, 3] }, 0),
    ).toThrow("winner seat must match first place");
  });
});
