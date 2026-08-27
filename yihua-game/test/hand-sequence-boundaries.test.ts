import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { classifyHand } from "../src/core/hand.js";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

describe("sequence hand boundaries", () => {
  it("recognizes ace-low and ace-high five-card straights", () => {
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
        suited("10", "clubs"),
        suited("J", "diamonds"),
        suited("Q", "spades"),
        suited("K", "hearts"),
        suited("A", "clubs"),
      ]),
    ).toMatchObject({ kind: "straight", highRank: "A" });
  });

  it("rejects a wraparound J-Q-K-A-2 sequence", () => {
    expect(
      classifyHand([
        suited("J"),
        suited("Q", "diamonds"),
        suited("K", "spades"),
        suited("A", "hearts"),
        suited("2"),
      ]).kind,
    ).toBe("invalid");
  });

  it("distinguishes a straight flush from a mixed-suit straight", () => {
    expect(
      classifyHand([
        suited("6", "hearts"),
        suited("7", "hearts"),
        suited("8", "hearts"),
        suited("9", "hearts"),
        suited("10", "hearts"),
      ]),
    ).toMatchObject({ kind: "straight-flush", highRank: "10" });
  });

  it("requires exact consecutive groups for pairs and triples", () => {
    expect(
      classifyHand([
        suited("3", "clubs"),
        suited("3", "diamonds"),
        suited("4", "clubs"),
        suited("4", "diamonds"),
        suited("5", "clubs"),
        suited("5", "diamonds"),
      ]),
    ).toMatchObject({ kind: "consecutive-pairs", highRank: "5" });

    expect(
      classifyHand([
        suited("6", "clubs"),
        suited("6", "diamonds"),
        suited("6", "spades"),
        suited("7", "clubs"),
        suited("7", "diamonds"),
        suited("7", "spades"),
      ]),
    ).toMatchObject({ kind: "consecutive-triples", highRank: "7" });

    expect(
      classifyHand([
        suited("3", "clubs"),
        suited("3", "diamonds"),
        suited("5", "clubs"),
        suited("5", "diamonds"),
        suited("6", "clubs"),
        suited("6", "diamonds"),
      ]).kind,
    ).toBe("invalid");
  });

  it("rejects ordinary combinations that mix suited cards and jokers", () => {
    expect(
      classifyHand([
        suited("8"),
        { kind: "joker", size: "small" },
      ]).kind,
    ).toBe("invalid");
  });
});
