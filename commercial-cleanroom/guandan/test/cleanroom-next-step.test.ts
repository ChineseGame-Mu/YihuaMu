import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { createDeck } from "../src/core/deck.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";
import { runOpeningDraw } from "../src/core/opening-draw.js";
import {
  createTrickState,
  passTurn,
  playCards,
} from "../src/core/trick-state.js";

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});

describe("clean-room next-step integration", () => {
  it("opening draw selects one valid seat without jokers", () => {
    const result = runOpeningDraw(createDeck(4), 4, () => 0.25);
    expect(result.winnerSeat).toBeGreaterThanOrEqual(0);
    expect(result.winnerSeat).toBeLessThan(4);
    expect(result.attempts.length).toBeGreaterThan(0);
    for (const attempt of result.attempts) {
      expect(attempt.cards).toHaveLength(4);
      expect(attempt.cards.every(({ card }) => card.kind === "suited")).toBe(
        true,
      );
    }
  });

  it("compares normal hands and bomb hierarchy", () => {
    const pair9 = classifyHand([suited("9", "clubs"), suited("9", "hearts")]);
    const pair10 = classifyHand([
      suited("10", "clubs"),
      suited("10", "hearts"),
    ]);
    expect(canHandBeat(pair10, pair9)).toBe(true);

    const straightFlush = classifyHand([
      suited("5", "hearts"),
      suited("6", "hearts"),
      suited("7", "hearts"),
      suited("8", "hearts"),
      suited("9", "hearts"),
    ]);
    const fiveBomb = classifyHand([
      suited("3", "clubs"),
      suited("3", "diamonds"),
      suited("3", "hearts"),
      suited("3", "spades"),
      suited("3", "clubs"),
    ]);
    expect(canHandBeat(straightFlush, fiveBomb)).toBe(true);
  });

  it("requires the opening leader to play", () => {
    const state = createTrickState(4, 2);
    expect(() => passTurn(state, 2)).toThrow("leader cannot pass");
  });

  it("table state returns the lead after all opponents pass", () => {
    let state = createTrickState(4, 2);
    state = playCards(state, 2, [suited("8", "clubs")]);
    state = passTurn(state, 3);
    state = passTurn(state, 0);
    state = passTurn(state, 1);
    expect(state.currentTurn).toBe(2);
    expect(state.leaderSeat).toBe(2);
    expect(state.leadingPlay).toBeNull();
    expect(state.passedSeats).toEqual([]);
    expect(state.completedTricks).toBe(1);
  });

  it("requires the previous trick winner to lead after the table clears", () => {
    let state = createTrickState(4, 2);
    state = playCards(state, 2, [suited("8", "clubs")]);
    state = passTurn(state, 3);
    state = passTurn(state, 0);
    state = passTurn(state, 1);

    expect(() => passTurn(state, 2)).toThrow("leader cannot pass");

    state = playCards(state, 2, [suited("9", "clubs")]);
    expect(state.leadingPlay?.seat).toBe(2);
    expect(state.leaderSeat).toBe(2);
    expect(state.currentTurn).toBe(3);
    expect(state.passedSeats).toEqual([]);
  });

  it("clears stale passes when a later seat overtakes the leading play", () => {
    let state = createTrickState(4, 2);
    state = playCards(state, 2, [suited("8", "clubs")]);
    state = passTurn(state, 3);
    expect(state.passedSeats).toEqual([3]);

    state = playCards(state, 0, [suited("9", "clubs")]);
    expect(state.leadingPlay?.seat).toBe(0);
    expect(state.leaderSeat).toBe(0);
    expect(state.currentTurn).toBe(1);
    expect(state.passedSeats).toEqual([]);

    state = passTurn(state, 1);
    state = passTurn(state, 2);
    expect(state.leadingPlay?.seat).toBe(0);
    expect(state.completedTricks).toBe(0);

    state = passTurn(state, 3);
    expect(state.leadingPlay).toBeNull();
    expect(state.currentTurn).toBe(0);
    expect(state.leaderSeat).toBe(0);
    expect(state.completedTricks).toBe(1);
  });

  it("rejects play or pass from a seat that is not on turn", () => {
    const state = createTrickState(4, 1);
    expect(() => playCards(state, 2, [suited("8", "clubs")])).toThrow(
      "not this seat's turn",
    );
    expect(() => passTurn(state, 2)).toThrow("not this seat's turn");
  });
});
