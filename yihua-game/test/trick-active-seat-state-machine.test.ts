import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import { createTrickState, passTurn, playCards } from "../src/core/trick-state.js";

const card = (rank: "3" | "4" | "5" | "6"): Card => ({ kind: "suited", rank, suit: "clubs" });

describe("active-seat trick state machine", () => {
  it("skips finished seats while rotating turns", () => {
    let state = createTrickState(6, 0);
    state = playCards(state, 0, [card("3")], [0, 2, 4]);
    expect(state.currentTurn).toBe(2);
    state = passTurn(state, 2, [0, 2, 4]);
    expect(state.currentTurn).toBe(4);
    state = passTurn(state, 4, [0, 2, 4]);
    expect(state.currentTurn).toBe(0);
    expect(state.leadingPlay).toBeNull();
    expect(state.completedTricks).toBe(1);
  });

  it("hands the cleared table to the next active seat when the winner finished", () => {
    let state = createTrickState(6, 0);
    state = playCards(state, 0, [card("3")], [0, 2, 4]);
    state = playCards(state, 2, [card("4")], [0, 2, 4]);
    state = passTurn(state, 4, [0, 2, 4]);
    state = passTurn(state, 0, [0, 4]);
    expect(state.leadingPlay).toBeNull();
    expect(state.currentTurn).toBe(4);
    expect(state.leaderSeat).toBe(4);
  });

  it("resets stale passes whenever a later seat takes the lead", () => {
    let state = createTrickState(4, 0);
    state = playCards(state, 0, [card("3")]);
    state = passTurn(state, 1);
    expect(state.passedSeats).toEqual([1]);
    state = playCards(state, 2, [card("4")]);
    expect(state.passedSeats).toEqual([]);
    expect(state.leaderSeat).toBe(2);
    expect(state.currentTurn).toBe(3);
  });

  it("keeps the latest winner as leader after all remaining opponents pass", () => {
    let state = createTrickState(4, 0);
    state = playCards(state, 0, [card("3")]);
    state = playCards(state, 1, [card("4")]);
    state = passTurn(state, 2);
    state = passTurn(state, 3);
    state = passTurn(state, 0);
    expect(state.leadingPlay).toBeNull();
    expect(state.currentTurn).toBe(1);
    expect(state.leaderSeat).toBe(1);
    expect(state.completedTricks).toBe(1);
  });
});
