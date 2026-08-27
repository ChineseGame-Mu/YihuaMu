import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});

const straightFlush = (ranks: readonly Rank[], suit: Suit): Card[] =>
  ranks.map((rank) => suited(rank, suit));

const bomb = (rank: Rank, count: number): Card[] =>
  Array.from({ length: count }, (_, index) =>
    suited(
      rank,
      (["clubs", "diamonds", "spades", "hearts"] as const)[index % 4]!,
    ),
  );

const jokerBomb: Card[] = [
  { kind: "joker", size: "small" },
  { kind: "joker", size: "small" },
  { kind: "joker", size: "big" },
  { kind: "joker", size: "big" },
];

describe("straight-flush extreme boundaries", () => {
  it("treats A-2-3-4-5 as the lowest straight flush", () => {
    const wheel = classifyHand(straightFlush(["A", "2", "3", "4", "5"], "hearts"));
    const sixHigh = classifyHand(straightFlush(["2", "3", "4", "5", "6"], "spades"));

    expect(wheel).toMatchObject({ kind: "straight-flush", highRank: "5" });
    expect(sixHigh).toMatchObject({ kind: "straight-flush", highRank: "6" });
    expect(canHandBeat(sixHigh, wheel)).toBe(true);
    expect(canHandBeat(wheel, sixHigh)).toBe(false);
  });

  it("treats 10-J-Q-K-A as the highest straight flush", () => {
    const kingHigh = classifyHand(straightFlush(["9", "10", "J", "Q", "K"], "clubs"));
    const aceHigh = classifyHand(straightFlush(["10", "J", "Q", "K", "A"], "diamonds"));

    expect(canHandBeat(aceHigh, kingHigh)).toBe(true);
    expect(canHandBeat(kingHigh, aceHigh)).toBe(false);
  });

  it("does not let equal-rank straight flushes beat each other", () => {
    const hearts = classifyHand(straightFlush(["6", "7", "8", "9", "10"], "hearts"));
    const spades = classifyHand(straightFlush(["6", "7", "8", "9", "10"], "spades"));

    expect(canHandBeat(hearts, spades)).toBe(false);
    expect(canHandBeat(spades, hearts)).toBe(false);
  });

  it("keeps every five-card bomb below every straight flush", () => {
    const fiveA = classifyHand(bomb("A", 5));
    const wheel = classifyHand(straightFlush(["A", "2", "3", "4", "5"], "clubs"));

    expect(canHandBeat(wheel, fiveA)).toBe(true);
    expect(canHandBeat(fiveA, wheel)).toBe(false);
  });

  it("keeps every six-card bomb above every straight flush", () => {
    const six3 = classifyHand(bomb("3", 6));
    const aceHigh = classifyHand(straightFlush(["10", "J", "Q", "K", "A"], "hearts"));

    expect(canHandBeat(six3, aceHigh)).toBe(true);
    expect(canHandBeat(aceHigh, six3)).toBe(false);
  });

  it("keeps joker bomb above the highest straight flush", () => {
    const jokers = classifyHand(jokerBomb);
    const aceHigh = classifyHand(straightFlush(["10", "J", "Q", "K", "A"], "spades"));

    expect(canHandBeat(jokers, aceHigh)).toBe(true);
    expect(canHandBeat(aceHigh, jokers)).toBe(false);
  });
});
