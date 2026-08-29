import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import { createTrickState, passTurn, playCards } from "../src/core/trick-state.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const singleSeven: Card = {
  kind: "suited",
  suit: "clubs",
  rank: "7",
};

const supportedCounts: readonly SupportedPlayerCount[] = [4, 6, 8, 10, 12, 14];

describe("finished leader pass-cycle matrix", () => {
  it.each(supportedCounts)(
    "hands the next trick to the next active seat after a finishing leader for %i players",
    (playerCount) => {
      const finishedLeader = playerCount - 1;
      const activeSeats = Array.from({ length: playerCount - 1 }, (_, seat) => seat);
      let state = createTrickState(playerCount, finishedLeader);

      state = playCards(state, finishedLeader, [singleSeven], activeSeats);
      expect(state.currentTurn).toBe(0);
      expect(state.leaderSeat).toBe(finishedLeader);
      expect(state.leadingPlay?.seat).toBe(finishedLeader);

      for (const seat of activeSeats) {
        expect(state.currentTurn).toBe(seat);
        state = passTurn(state, seat, activeSeats);
      }

      expect(state.leadingPlay).toBeNull();
      expect(state.passedSeats).toEqual([]);
      expect(state.completedTricks).toBe(1);
      expect(state.leaderSeat).toBe(0);
      expect(state.currentTurn).toBe(0);
    },
  );
});
