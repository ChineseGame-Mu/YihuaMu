import { describe, expect, it } from "vitest";
import { classifyHand } from "../src/core/hand.js";
import type { Card, Rank, Suit } from "../src/core/cards.js";

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});

describe("classifyHand", () => {
  it("classifies singles, pairs, triples and bombs", () => {
    expect(classifyHand([suited("A", "clubs")])).toMatchObject({
      kind: "single",
      rank: "A",
    });
    expect(
      classifyHand([suited("3", "clubs"), suited("3", "hearts")]),
    ).toMatchObject({ kind: "pair", rank: "3" });
    expect(
      classifyHand([
        suited("2", "clubs"),
        suited("2", "diamonds"),
        suited("2", "hearts"),
      ]),
    ).toMatchObject({ kind: "triple", rank: "2" });
    expect(
      classifyHand([
        suited("A", "clubs"),
        suited("A", "diamonds"),
        suited("A", "spades"),
        suited("A", "hearts"),
      ]),
    ).toMatchObject({ kind: "bomb", size: 4, rank: "A" });
  });

  it("recognizes a full house by the triple rank", () => {
    expect(
      classifyHand([
        suited("7", "clubs"),
        suited("7", "diamonds"),
        suited("7", "hearts"),
        suited("K", "clubs"),
        suited("K", "spades"),
      ]),
    ).toMatchObject({ kind: "full-house", rank: "7" });
  });

  it("recognizes straights including A2345 and straight flushes", () => {
    expect(
      classifyHand([
        suited("A", "clubs"),
        suited("2", "diamonds"),
        suited("3", "spades"),
        suited("4", "hearts"),
        suited("5", "clubs"),
      ]),
    ).toMatchObject({ kind: "straight", highRank: "5" });

    expect(
      classifyHand([
        suited("10", "hearts"),
        suited("J", "hearts"),
        suited("Q", "hearts"),
        suited("K", "hearts"),
        suited("A", "hearts"),
      ]),
    ).toMatchObject({ kind: "straight-flush", highRank: "A" });
  });

  it("recognizes consecutive pairs and consecutive triples", () => {
    expect(
      classifyHand([
        suited("4", "clubs"),
        suited("4", "hearts"),
        suited("5", "clubs"),
        suited("5", "diamonds"),
        suited("6", "spades"),
        suited("6", "hearts"),
      ]),
    ).toMatchObject({ kind: "consecutive-pairs", highRank: "6" });

    expect(
      classifyHand([
        suited("9", "clubs"),
        suited("9", "diamonds"),
        suited("9", "hearts"),
        suited("10", "clubs"),
        suited("10", "diamonds"),
        suited("10", "spades"),
      ]),
    ).toMatchObject({ kind: "consecutive-triples", highRank: "10" });
  });

  it("recognizes four jokers as a joker bomb", () => {
    const cards: Card[] = [
      { kind: "joker", size: "small" },
      { kind: "joker", size: "small" },
      { kind: "joker", size: "big" },
      { kind: "joker", size: "big" },
    ];
    expect(classifyHand(cards).kind).toBe("joker-bomb");
  });

  it("rejects unmatched groups", () => {
    expect(
      classifyHand([suited("2", "clubs"), suited("3", "clubs")]).kind,
    ).toBe("invalid");
  });
});
