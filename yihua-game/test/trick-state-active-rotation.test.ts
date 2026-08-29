import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import {
  createTrickState,
  passTurn,
  playCards,
} from "../src/core/trick-state.js";

const single = (rank: "3" | "4" | "5" | "6" | "7"): Card => ({
  kind: "suited",
  suit: "clubs",
  rank,
});

describe("table trick state active-seat rotation", () => {
  it("skips a player who finishes while preserving the finisher as trick leader", () => {
    let state = createTrickState(4, 0);
    state = playCards(state, 0, [single("3")], [1, 2, 3]);

    expect(state.leadingPlay?.seat).toBe(0);
    expect(state.leaderSeat).toBe(0);
    expect(state.currentTurn).toBe(1);

    state = passTurn(state, 1, [1, 2, 3]);
    state = passTurn(state, 2, [1, 2, 3]);
    state = passTurn(state, 3, [1, 2, 3]);

    expect(state.completedTricks).toBe(1);
    expect(state.leadingPlay).toBeNull();
    expect(state.leaderSeat).toBe(1);
    expect(state.currentTurn).toBe(1);
  });

  it.each([4, 6, 8, 10, 12, 14] as const)(
    "closes a trick using only active seats at a %i-player table",
    (playerCount) => {
      const activeSeats = Array.from(
        { length: playerCount - 1 },
        (_, index) => index + 1,
      );
      let state = createTrickState(playerCount, 0);
      state = playCards(state, 0, [single("7")], activeSeats);

      for (const seat of activeSeats) {
        state = passTurn(state, seat, activeSeats);
      }

      expect(state.completedTricks).toBe(1);
      expect(state.leadingPlay).toBeNull();
      expect(state.leaderSeat).toBe(1);
      expect(state.currentTurn).toBe(1);
      expect(state.passedSeats).toEqual([]);
    },
  );

  it("rejects passing from a seat removed from the active rotation", () => {
    let state = createTrickState(4, 0);
    state = playCards(state, 0, [single("4")]);

    expect(() => passTurn(state, 1, [0, 2, 3])).toThrow(
      "current turn must be an active seat",
    );
  });
});
