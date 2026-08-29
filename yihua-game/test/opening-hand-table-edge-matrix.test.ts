import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { createDeck } from "../src/core/deck.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";
import { runOpeningDraw } from "../src/core/opening-draw.js";
import { createTrickState, passTurn, playCards } from "../src/core/trick-state.js";

const suited = (rank: Rank, suit: Suit): Card => ({ kind: "suited", rank, suit });
const joker = (size: "small" | "big"): Card => ({ kind: "joker", size });

describe("opening draw, hand judgement, and table-state edge matrix", () => {
  it.each([4, 6, 8, 10, 12, 14] as const)(
    "opening draw stays joker-free and finds one winner at %i seats",
    (playerCount) => {
      const result = runOpeningDraw(createDeck(playerCount), playerCount, () => 0.375);
      expect(result.winnerSeat).toBeGreaterThanOrEqual(0);
      expect(result.winnerSeat).toBeLessThan(playerCount);
      expect(result.attempts.length).toBeGreaterThan(0);
      for (const attempt of result.attempts) {
        expect(attempt.cards).toHaveLength(playerCount);
        expect(attempt.cards.every(({ card }) => card.kind === "suited")).toBe(true);
      }
    },
  );

  it("recognizes the low-A straight but rejects a 2-high wrap", () => {
    expect(
      classifyHand([
        suited("A", "clubs"),
        suited("2", "diamonds"),
        suited("3", "hearts"),
        suited("4", "spades"),
        suited("5", "clubs"),
      ]),
    ).toMatchObject({ kind: "straight", highRank: "5" });

    expect(
      classifyHand([
        suited("J", "clubs"),
        suited("Q", "diamonds"),
        suited("K", "hearts"),
        suited("A", "spades"),
        suited("2", "clubs"),
      ]).kind,
    ).toBe("invalid");
  });

  it("enforces the bomb ladder across 4-card, 5-card, straight-flush, 6-card and joker bombs", () => {
    const fourBomb = classifyHand([
      suited("A", "clubs"),
      suited("A", "diamonds"),
      suited("A", "hearts"),
      suited("A", "spades"),
    ]);
    const fiveBomb = classifyHand([
      suited("3", "clubs"),
      suited("3", "diamonds"),
      suited("3", "hearts"),
      suited("3", "spades"),
      suited("3", "clubs"),
    ]);
    const straightFlush = classifyHand([
      suited("5", "hearts"),
      suited("6", "hearts"),
      suited("7", "hearts"),
      suited("8", "hearts"),
      suited("9", "hearts"),
    ]);
    const sixBomb = classifyHand([
      suited("2", "clubs"),
      suited("2", "diamonds"),
      suited("2", "hearts"),
      suited("2", "spades"),
      suited("2", "clubs"),
      suited("2", "diamonds"),
    ]);
    const jokerBomb = classifyHand([
      joker("small"),
      joker("small"),
      joker("big"),
      joker("big"),
    ]);

    expect(canHandBeat(fiveBomb, fourBomb)).toBe(true);
    expect(canHandBeat(straightFlush, fiveBomb)).toBe(true);
    expect(canHandBeat(sixBomb, straightFlush)).toBe(true);
    expect(canHandBeat(jokerBomb, sixBomb)).toBe(true);
  });

  it.each([4, 6, 8, 10, 12, 14] as const)(
    "table rotation skips inactive seats and clears the trick at %i seats",
    (playerCount) => {
      const activeSeats = [0, 2, playerCount - 1].filter(
        (seat, index, seats) => seats.indexOf(seat) === index,
      );
      let state = createTrickState(playerCount, 0);
      state = playCards(state, 0, [suited("8", "clubs")], activeSeats);
      expect(state.currentTurn).toBe(activeSeats[1]);

      state = passTurn(state, activeSeats[1]!, activeSeats);
      expect(state.currentTurn).toBe(activeSeats[2]);
      state = passTurn(state, activeSeats[2]!, activeSeats);

      expect(state.leadingPlay).toBeNull();
      expect(state.currentTurn).toBe(0);
      expect(state.leaderSeat).toBe(0);
      expect(state.completedTricks).toBe(1);
      expect(state.passedSeats).toEqual([]);
    },
  );
});
