import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});

const mixedStraight = (ranks: readonly Rank[]): Card[] => {
  const suits: readonly Suit[] = ["clubs", "hearts", "spades", "diamonds", "clubs"];
  return ranks.map((rank, index) => suited(rank, suits[index]!));
};

const flushStraight = (ranks: readonly Rank[], suit: Suit): Card[] =>
  ranks.map((rank) => suited(rank, suit));

describe("straight versus straight-flush boundary matrix", () => {
  it.each([
    [["3", "4", "5", "6", "7"] as const, "7"],
    [["10", "J", "Q", "K", "A"] as const, "A"],
    [["A", "2", "3", "4", "5"] as const, "5"],
  ])("keeps mixed-suit sequence %j as an ordinary straight", (ranks, highRank) => {
    expect(classifyHand(mixedStraight(ranks))).toMatchObject({
      kind: "straight",
      highRank,
    });
  });

  it.each(["clubs", "diamonds", "hearts", "spades"] as const)(
    "promotes a same-suit sequence to straight-flush in %s",
    (suit) => {
      expect(
        classifyHand(flushStraight(["3", "4", "5", "6", "7"], suit)),
      ).toMatchObject({
        kind: "straight-flush",
        highRank: "7",
      });
    },
  );

  it("keeps straight-flush above an otherwise higher ordinary straight", () => {
    const ordinary = classifyHand(mixedStraight(["10", "J", "Q", "K", "A"]));
    const straightFlush = classifyHand(
      flushStraight(["3", "4", "5", "6", "7"], "hearts"),
    );

    expect(canHandBeat(straightFlush, ordinary)).toBe(true);
    expect(canHandBeat(ordinary, straightFlush)).toBe(false);
  });
});
