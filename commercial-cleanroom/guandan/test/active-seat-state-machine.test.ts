import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import {
  createTrickState,
  passTurn,
  playCards,
} from "../src/core/trick-state.js";

const single = (rank: "7" | "8" | "9"): Card => ({
  kind: "suited",
  suit: "clubs",
  rank,
});

describe("active-seat table state", () => {
  it("skips finished seats while preserving the live trick winner", () => {
    let state = createTrickState(4, 0);
    state = playCards(state, 0, [single("7")], [0, 1, 3]);
    expect(state.currentTurn).toBe(1);

    state = passTurn(state, 1, [0, 1, 3]);
    expect(state.currentTurn).toBe(3);

    state = playCards(state, 3, [single("8")], [0, 1, 3]);
    expect(state.currentTurn).toBe(0);
    expect(state.leaderSeat).toBe(3);

    state = passTurn(state, 0, [0, 1, 3]);
    state = passTurn(state, 1, [0, 1, 3]);
    expect(state.leadingPlay).toBeNull();
    expect(state.currentTurn).toBe(3);
    expect(state.leaderSeat).toBe(3);
    expect(state.completedTricks).toBe(1);
  });

  it("deduplicates active-seat input so pass quorum cannot be inflated", () => {
    let state = createTrickState(4, 0);
    state = playCards(state, 0, [single("7")], [0, 1, 1, 3]);
    state = passTurn(state, 1, [0, 1, 1, 3]);
    state = passTurn(state, 3, [0, 1, 1, 3]);

    expect(state.leadingPlay).toBeNull();
    expect(state.currentTurn).toBe(0);
    expect(state.completedTricks).toBe(1);
  });

  it("rejects malformed active-seat snapshots before advancing the table", () => {
    const state = createTrickState(4, 0);
    expect(() => playCards(state, 0, [single("7")], [])).toThrow(
      "active seats must be valid table seats",
    );
    expect(() => playCards(state, 0, [single("7")], [0, 4])).toThrow(
      "active seats must be valid table seats",
    );
  });

  it("allows a finishing player to be absent from the post-play active snapshot", () => {
    const state = createTrickState(4, 0);
    const next = playCards(state, 0, [single("7")], [1, 2, 3]);

    expect(next.leaderSeat).toBe(0);
    expect(next.currentTurn).toBe(1);
  });

  it("continues to compare plays correctly across a reduced active table", () => {
    let state = createTrickState(4, 0);
    state = playCards(state, 0, [single("8")], [0, 2, 3]);
    expect(state.currentTurn).toBe(2);
    expect(() => playCards(state, 2, [single("7")], [0, 2, 3])).toThrow(
      "played hand does not beat the current hand",
    );

    state = playCards(state, 2, [single("9")], [0, 2, 3]);
    expect(state.leaderSeat).toBe(2);
    expect(state.currentTurn).toBe(3);
  });
});
