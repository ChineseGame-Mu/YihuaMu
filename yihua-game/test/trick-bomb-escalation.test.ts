import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { createTrickState, playCards } from "../src/core/trick-state.js";

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});
const bomb = (rank: Rank, count: number): Card[] =>
  Array.from({ length: count }, (_, index) =>
    suited(
      rank,
      (["clubs", "diamonds", "spades", "hearts"] as const)[index % 4]!,
    ),
  );
const straightFlush = (ranks: readonly Rank[]): Card[] =>
  ranks.map((rank) => suited(rank, "spades"));
const jokerBomb: Card[] = [
  { kind: "joker", size: "small" },
  { kind: "joker", size: "small" },
  { kind: "joker", size: "big" },
  { kind: "joker", size: "big" },
];

describe("bomb escalation in a live trick", () => {
  it("accepts the full bomb hierarchy while advancing the winner seat", () => {
    let trick = createTrickState(6, 0);

    trick = playCards(trick, 0, [suited("A", "clubs"), suited("A", "hearts")]);
    expect(trick.leadingPlay?.seat).toBe(0);

    trick = playCards(trick, 1, bomb("3", 4));
    expect(trick.leadingPlay?.hand.kind).toBe("bomb");
    expect(trick.leadingPlay?.seat).toBe(1);

    trick = playCards(trick, 2, bomb("4", 5));
    expect(trick.leadingPlay?.seat).toBe(2);

    trick = playCards(trick, 3, straightFlush(["10", "J", "Q", "K", "A"]));
    expect(trick.leadingPlay?.hand.kind).toBe("straight-flush");
    expect(trick.leadingPlay?.seat).toBe(3);

    trick = playCards(trick, 4, bomb("3", 6));
    expect(trick.leadingPlay?.seat).toBe(4);

    trick = playCards(trick, 5, jokerBomb);
    expect(trick.leadingPlay?.hand.kind).toBe("joker-bomb");
    expect(trick.leadingPlay?.seat).toBe(5);
  });

  it("rejects a weaker bomb after a stronger live leading play", () => {
    let trick = createTrickState(4, 0);
    trick = playCards(trick, 0, bomb("9", 6));

    expect(() =>
      playCards(trick, 1, straightFlush(["10", "J", "Q", "K", "A"])),
    ).toThrow("play does not beat the current leading play");
    expect(() => playCards(trick, 1, bomb("A", 5))).toThrow(
      "play does not beat the current leading play",
    );
  });
});
