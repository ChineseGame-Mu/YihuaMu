import { describe, expect, it } from "vitest";
import {
  completeRound,
  createLobbyState,
  startGame,
  startNextRound,
  type PlayingState,
} from "../src/core/game-state.js";

const random = () => 0.37;

const rotateOrder = (playerCount: number, firstSeat: number) =>
  Array.from(
    { length: playerCount },
    (_, offset) => (firstSeat + offset) % playerCount,
  );

describe("three-round table lifecycle regression", () => {
  it.each([4, 6, 8, 10, 12, 14])(
    "keeps winner-led turn ownership stable across three %i-player rounds",
    (playerCount) => {
      let state: PlayingState = startGame(
        createLobbyState(playerCount, 0),
        random,
      );
      const openingDraw = state.openingDraw;

      for (let round = 0; round < 3; round += 1) {
        const firstSeat = (round + 1) % playerCount;
        const finishOrder = rotateOrder(playerCount, firstSeat);
        const completed = completeRound(
          { ...state, finishedSeats: finishOrder },
          firstSeat,
        );

        expect(completed.phase).toBe("round-complete");
        expect(completed.outcome?.firstPlaceSeat).toBe(firstSeat);
        expect(completed.finishedSeats).toEqual(finishOrder);
        expect(completed.openingDraw).toEqual(openingDraw);

        if (round === 2) break;

        state = startNextRound(completed, random);
        expect(state.phase).toBe("playing");
        expect(state.currentTurn).toBe(firstSeat);
        expect(state.trick.leaderSeat).toBe(firstSeat);
        expect(state.trick.leadingPlay).toBeNull();
        expect(state.finishedSeats).toEqual([]);
        expect(state.hands).toHaveLength(playerCount);
        expect(state.hands.every((hand) => hand.length === 27)).toBe(true);
        expect(state.openingDraw).toEqual(openingDraw);
      }
    },
  );
});
