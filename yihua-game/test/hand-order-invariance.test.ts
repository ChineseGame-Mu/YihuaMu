import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { classifyHand } from "../src/core/hand.js";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const hands: readonly Card[][] = [
  [suited("A")],
  [suited("9"), suited("9", "hearts")],
  [suited("7"), suited("7", "hearts"), suited("7", "spades")],
  [suited("Q"), suited("Q", "diamonds"), suited("Q", "spades"), suited("5"), suited("5", "hearts")],
  [suited("6"), suited("7", "diamonds"), suited("8", "spades"), suited("9", "hearts"), suited("10")],
  ["6", "7", "8", "9", "10"].map((rank) => suited(rank as Rank, "hearts")),
  [suited("J"), suited("J", "hearts"), suited("Q"), suited("Q", "hearts"), suited("K"), suited("K", "hearts")],
  [suited("9"), suited("9", "diamonds"), suited("9", "hearts"), suited("10"), suited("10", "diamonds"), suited("10", "hearts")],
  [suited("4"), suited("4", "diamonds"), suited("4", "spades"), suited("4", "hearts")],
  [
    { kind: "joker", size: "small" },
    { kind: "joker", size: "small" },
    { kind: "joker", size: "big" },
    { kind: "joker", size: "big" },
  ],
];

const rotations = (cards: readonly Card[]): Card[][] =>
  cards.map((_, offset) => [...cards.slice(offset), ...cards.slice(0, offset)]);

describe("hand order invariance", () => {
  it("classifies every supported hand identically regardless of card order", () => {
    for (const cards of hands) {
      const expected = classifyHand(cards);
      const permutations = [cards.slice().reverse(), ...rotations(cards)];

      for (const permutation of permutations) {
        expect(classifyHand(permutation)).toEqual(expected);
      }
    }
  });
});
