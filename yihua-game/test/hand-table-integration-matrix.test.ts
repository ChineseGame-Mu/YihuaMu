import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { classifyHand, type HandKind } from "../src/core/hand.js";
import { createTrickState, playCards } from "../src/core/trick-state.js";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const repeated = (rank: Rank, count: number): Card[] =>
  Array.from({ length: count }, () => suited(rank));

const joker = (size: "small" | "big"): Card => ({ kind: "joker", size });

const completeHands: readonly [HandKind, readonly Card[]][] = [
  ["single", [suited("7")]],
  ["pair", repeated("7", 2)],
  ["triple", repeated("7", 3)],
  ["full-house", [...repeated("7", 3), ...repeated("8", 2)]],
  [
    "straight",
    [
      suited("3", "clubs"),
      suited("4", "diamonds"),
      suited("5", "spades"),
      suited("6", "hearts"),
      suited("7", "clubs"),
    ],
  ],
  [
    "straight-flush",
    ["3", "4", "5", "6", "7"].map((rank) => suited(rank as Rank, "hearts")),
  ],
  [
    "consecutive-pairs",
    [...repeated("3", 2), ...repeated("4", 2), ...repeated("5", 2)],
  ],
  [
    "consecutive-triples",
    [...repeated("3", 3), ...repeated("4", 3)],
  ],
  ["bomb", repeated("7", 4)],
  ["joker-bomb", [joker("small"), joker("small"), joker("big"), joker("big")]],
];

describe("complete hand judgment integrated with table state", () => {
  it.each(completeHands)("accepts %s as a legal opening table play", (kind, cards) => {
    const classified = classifyHand(cards);
    expect(classified.kind).toBe(kind);

    const state = playCards(createTrickState(4, 0), 0, cards);
    expect(state.leadingPlay?.hand.kind).toBe(kind);
    expect(state.leadingPlay?.seat).toBe(0);
    expect(state.currentTurn).toBe(1);
  });

  it("enforces the Guandan bomb hierarchy through consecutive table turns", () => {
    let state = createTrickState(4, 0);
    state = playCards(state, 0, repeated("A", 2));
    state = playCards(state, 1, repeated("3", 4));

    const straightFlush = ["3", "4", "5", "6", "7"].map((rank) =>
      suited(rank as Rank, "spades"),
    );
    state = playCards(state, 2, straightFlush);
    state = playCards(state, 3, repeated("2", 6));

    expect(state.leadingPlay?.seat).toBe(3);
    expect(state.leadingPlay?.hand).toMatchObject({ kind: "bomb", size: 6 });
    expect(state.plays.map(({ hand }) => hand.kind)).toEqual([
      "pair",
      "bomb",
      "straight-flush",
      "bomb",
    ]);
    expect(state.currentTurn).toBe(0);
  });

  it("rejects a weaker same-kind response without advancing table state", () => {
    let state = createTrickState(4, 0);
    state = playCards(state, 0, repeated("9", 2));

    expect(() => playCards(state, 1, repeated("8", 2))).toThrow(
      "played hand does not beat the current hand",
    );
    expect(state.currentTurn).toBe(1);
    expect(state.leadingPlay?.seat).toBe(0);
    expect(state.plays).toHaveLength(1);
  });
});
