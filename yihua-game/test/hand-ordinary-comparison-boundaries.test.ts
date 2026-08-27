import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});

const fullHouse = (triple: Rank, pair: Rank): Card[] => [
  suited(triple, "clubs"),
  suited(triple, "diamonds"),
  suited(triple, "hearts"),
  suited(pair, "clubs"),
  suited(pair, "spades"),
];

const consecutivePairs = (ranks: readonly [Rank, Rank, Rank]): Card[] =>
  ranks.flatMap((rank) => [suited(rank, "clubs"), suited(rank, "hearts")]);

const consecutiveTriples = (ranks: readonly [Rank, Rank]): Card[] =>
  ranks.flatMap((rank) => [
    suited(rank, "clubs"),
    suited(rank, "diamonds"),
    suited(rank, "hearts"),
  ]);

describe("ordinary hand comparison boundaries", () => {
  it("compares full houses only by the triple rank", () => {
    const sevens = classifyHand(fullHouse("7", "A"));
    const eights = classifyHand(fullHouse("8", "3"));
    const sevensWithLowPair = classifyHand(fullHouse("7", "3"));

    expect(canHandBeat(eights, sevens)).toBe(true);
    expect(canHandBeat(sevens, eights)).toBe(false);
    expect(canHandBeat(sevensWithLowPair, sevens)).toBe(false);
    expect(canHandBeat(sevens, sevensWithLowPair)).toBe(false);
  });

  it("compares consecutive pairs by their high rank", () => {
    const sixHigh = classifyHand(consecutivePairs(["4", "5", "6"]));
    const sevenHigh = classifyHand(consecutivePairs(["5", "6", "7"]));

    expect(canHandBeat(sevenHigh, sixHigh)).toBe(true);
    expect(canHandBeat(sixHigh, sevenHigh)).toBe(false);
  });

  it("compares consecutive triples by their high rank", () => {
    const tenHigh = classifyHand(consecutiveTriples(["9", "10"]));
    const jackHigh = classifyHand(consecutiveTriples(["10", "J"]));

    expect(canHandBeat(jackHigh, tenHigh)).toBe(true);
    expect(canHandBeat(tenHigh, jackHigh)).toBe(false);
  });

  it("orders a big joker single above a small joker single", () => {
    const small = classifyHand([{ kind: "joker", size: "small" }]);
    const big = classifyHand([{ kind: "joker", size: "big" }]);

    expect(canHandBeat(big, small)).toBe(true);
    expect(canHandBeat(small, big)).toBe(false);
    expect(canHandBeat(big, big)).toBe(false);
  });

  it("never compares an invalid hand as a winning play", () => {
    const invalid = classifyHand([suited("3", "clubs"), suited("4", "clubs")]);
    const pair = classifyHand([suited("A", "clubs"), suited("A", "hearts")]);

    expect(invalid.kind).toBe("invalid");
    expect(canHandBeat(invalid, pair)).toBe(false);
    expect(canHandBeat(pair, invalid)).toBe(false);
  });
});
