import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { canHandBeat, classifyHand, type HandKind } from "../src/core/hand.js";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const cases: readonly [HandKind, Card[]][] = [
  ["single", [suited("A")]],
  ["pair", [suited("9"), suited("9", "hearts")]],
  ["triple", [suited("7"), suited("7", "hearts"), suited("7", "spades")]],
  [
    "full-house",
    [
      suited("Q"),
      suited("Q", "diamonds"),
      suited("Q", "spades"),
      suited("5"),
      suited("5", "hearts"),
    ],
  ],
  [
    "straight",
    [
      suited("6"),
      suited("7", "diamonds"),
      suited("8", "spades"),
      suited("9", "hearts"),
      suited("10"),
    ],
  ],
  [
    "straight-flush",
    ["6", "7", "8", "9", "10"].map((rank) => suited(rank as Rank, "hearts")),
  ],
  [
    "consecutive-pairs",
    [
      suited("J"),
      suited("J", "hearts"),
      suited("Q"),
      suited("Q", "hearts"),
      suited("K"),
      suited("K", "hearts"),
    ],
  ],
  [
    "consecutive-triples",
    [
      suited("9"),
      suited("9", "diamonds"),
      suited("9", "hearts"),
      suited("10"),
      suited("10", "diamonds"),
      suited("10", "hearts"),
    ],
  ],
  [
    "bomb",
    [suited("4"), suited("4", "diamonds"), suited("4", "spades"), suited("4", "hearts")],
  ],
  [
    "joker-bomb",
    [
      { kind: "joker", size: "small" },
      { kind: "joker", size: "small" },
      { kind: "joker", size: "big" },
      { kind: "joker", size: "big" },
    ],
  ],
];

describe("complete hand classification matrix", () => {
  for (const [kind, cards] of cases) {
    it(`classifies ${kind}`, () => {
      expect(classifyHand(cards).kind).toBe(kind);
    });
  }

  it("orders joker singles above suited singles and big joker above small joker", () => {
    const ace = classifyHand([suited("A")]);
    const small = classifyHand([{ kind: "joker", size: "small" }]);
    const big = classifyHand([{ kind: "joker", size: "big" }]);

    expect(canHandBeat(small, ace)).toBe(true);
    expect(canHandBeat(big, small)).toBe(true);
    expect(canHandBeat(ace, small)).toBe(false);
  });

  it("does not compare different ordinary hand kinds even when card counts match", () => {
    const fullHouse = classifyHand([
      suited("K"),
      suited("K", "diamonds"),
      suited("K", "spades"),
      suited("3"),
      suited("3", "hearts"),
    ]);
    const straight = classifyHand([
      suited("8"),
      suited("9", "diamonds"),
      suited("10", "spades"),
      suited("J", "hearts"),
      suited("Q"),
    ]);

    expect(canHandBeat(fullHouse, straight)).toBe(false);
    expect(canHandBeat(straight, fullHouse)).toBe(false);
  });
});
