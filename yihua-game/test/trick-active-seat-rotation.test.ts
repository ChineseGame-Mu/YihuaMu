import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import {
  createTrickState,
  passTurn,
  playCards,
} from "../src/core/trick-state.js";

const suited = (rank: number): Card => ({
  kind: "suited",
  suit: "clubs",
  rank,
});

describe("active-seat trick rotation", () => {
  it("skips seats that are no longer active", () => {
    const activeSeats = [0, 2, 3] as const;
    let trick = createTrickState(4, 0);

    trick = playCards(trick, 0, [suited(6)], activeSeats);
    expect(trick.currentTurn).toBe(2);

    trick = passTurn(trick, 2, activeSeats);
    expect(trick.currentTurn).toBe(3);

    trick = passTurn(trick, 3, activeSeats);
    expect(trick.currentTurn).toBe(0);
    expect(trick.leadingPlay).toBeNull();
    expect(trick.completedTricks).toBe(1);
  });

  it("returns a completed trick to the next active seat when the winner is inactive", () => {
    const activeSeats = [1, 3] as const;
    let trick = createTrickState(4, 0);

    trick = playCards(trick, 0, [suited(9)], activeSeats);
    expect(trick.currentTurn).toBe(1);

    trick = passTurn(trick, 1, activeSeats);
    expect(trick.currentTurn).toBe(3);

    trick = passTurn(trick, 3, activeSeats);
    expect(trick.currentTurn).toBe(1);
    expect(trick.leaderSeat).toBe(1);
    expect(trick.leadingPlay).toBeNull();
    expect(trick.completedTricks).toBe(1);
  });
});
