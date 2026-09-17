import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const classify = (...cards: Card[]) => classifyHand(cards);

describe("hand equality and bomb boundaries", () => {
  it("never lets an equal ordinary hand beat itself", () => {
    const cases = [
      classify(suited("9")),
      classify(suited("Q"), suited("Q", "diamonds")),
      classify(suited("K"), suited("K", "diamonds"), suited("K", "spades")),
      classify(
        suited("J"),
        suited("J", "diamonds"),
        suited("J", "spades"),
        suited("4"),
        suited("4", "diamonds"),
      ),
    ];

    for (const hand of cases) expect(canHandBeat(hand, hand)).toBe(false);
  });

  it("compares equal-length straights and straight flushes by high rank", () => {
    const lowStraight = classify(
      suited("3"),
      suited("4", "diamonds"),
      suited("5", "spades"),
      suited("6", "hearts"),
      suited("7"),
    );
    const highStraight = classify(
      suited("4"),
      suited("5", "diamonds"),
      suited("6", "spades"),
      suited("7", "hearts"),
      suited("8"),
    );
    expect(canHandBeat(highStraight, lowStraight)).toBe(true);
    expect(canHandBeat(lowStraight, highStraight)).toBe(false);

    const lowFlush = classify(
      suited("6", "hearts"),
      suited("7", "hearts"),
      suited("8", "hearts"),
      suited("9", "hearts"),
      suited("10", "hearts"),
    );
    const highFlush = classify(
      suited("7", "spades"),
      suited("8", "spades"),
      suited("9", "spades"),
      suited("10", "spades"),
      suited("J", "spades"),
    );
    expect(canHandBeat(highFlush, lowFlush)).toBe(true);
    expect(canHandBeat(lowFlush, highFlush)).toBe(false);
  });

  it("keeps bomb equality strict and preserves bomb hierarchy boundaries", () => {
    const fourNines = classify(
      suited("9"),
      suited("9", "diamonds"),
      suited("9", "spades"),
      suited("9", "hearts"),
    );
    const fourTens = classify(
      suited("10"),
      suited("10", "diamonds"),
      suited("10", "spades"),
      suited("10", "hearts"),
    );
    const fiveThrees = classify(
      suited("3"),
      suited("3", "diamonds"),
      suited("3", "spades"),
      suited("3", "hearts"),
      suited("3"),
    );
    const straightFlush = classify(
      suited("3", "hearts"),
      suited("4", "hearts"),
      suited("5", "hearts"),
      suited("6", "hearts"),
      suited("7", "hearts"),
    );
    const sixThrees = classify(
      suited("3"),
      suited("3", "diamonds"),
      suited("3", "spades"),
      suited("3", "hearts"),
      suited("3"),
      suited("3", "diamonds"),
    );
    const jokerBomb = classify(
      { kind: "joker", size: "small" },
      { kind: "joker", size: "small" },
      { kind: "joker", size: "big" },
      { kind: "joker", size: "big" },
    );

    expect(canHandBeat(fourNines, fourNines)).toBe(false);
    expect(canHandBeat(fourTens, fourNines)).toBe(true);
    expect(canHandBeat(fiveThrees, fourTens)).toBe(true);
    expect(canHandBeat(straightFlush, fiveThrees)).toBe(true);
    expect(canHandBeat(sixThrees, straightFlush)).toBe(true);
    expect(canHandBeat(jokerBomb, sixThrees)).toBe(true);
    expect(canHandBeat(sixThrees, jokerBomb)).toBe(false);
    expect(canHandBeat(jokerBomb, jokerBomb)).toBe(false);
  });
});
