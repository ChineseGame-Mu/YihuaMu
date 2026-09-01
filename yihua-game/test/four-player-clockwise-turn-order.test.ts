import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import {
  createTrickState,
  passTurn,
  playCards,
} from "../src/core/trick-state.js";

const single = (rank: "6" | "7"): Card => ({
  kind: "suited",
  suit: "clubs",
  rank,
});

describe("four-player clockwise turn order", () => {
  it("keeps an ordinary live trick in strict 1 -> 2 -> 3 -> 4 order", () => {
    let state = createTrickState(4, 0);

    state = playCards(state, 0, [single("6")]);
    expect(state.currentTurn).toBe(1);

    state = passTurn(state, 1);
    expect(state.currentTurn).toBe(2);

    state = passTurn(state, 2);
    expect(state.currentTurn).toBe(3);

    state = passTurn(state, 3);
    expect(state.leadingPlay).toBeNull();
    expect(state.currentTurn).toBe(0);
    expect(state.leaderSeat).toBe(0);
  });

  it("does not skip directly from player 1 to teammate player 3 while player 2 is active", () => {
    const state = playCards(createTrickState(4, 0), 0, [single("7")]);
    expect(state.currentTurn).toBe(1);
    expect(state.currentTurn).not.toBe(2);
  });
});
