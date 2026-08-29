import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { classifyHandWithLevel } from "../src/core/level-hand.js";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const wild = (levelRank: Rank): Card => suited(levelRank, "hearts");

describe("level wildcard hand classification", () => {
  it("keeps a naturally valid hand unchanged", () => {
    expect(
      classifyHandWithLevel([suited("6", "hearts"), suited("6", "clubs")], "6"),
    ).toEqual({ kind: "pair", size: 2, rank: "6" });
  });

  it("completes pair, triple, and bomb with a heart level wildcard", () => {
    expect(classifyHandWithLevel([suited("9"), wild("6")], "6")).toEqual({
      kind: "pair",
      size: 2,
      rank: "9",
    });
    expect(
      classifyHandWithLevel(
        [suited("9"), suited("9", "spades"), wild("6")],
        "6",
      ),
    ).toEqual({ kind: "triple", size: 3, rank: "9" });
    expect(
      classifyHandWithLevel(
        [
          suited("9"),
          suited("9", "spades"),
          suited("9", "diamonds"),
          wild("6"),
        ],
        "6",
      ),
    ).toEqual({ kind: "bomb", size: 4, rank: "9" });
  });

  it("completes full house while preserving the triple rank", () => {
    expect(
      classifyHandWithLevel(
        [
          suited("Q"),
          suited("Q", "spades"),
          suited("8"),
          suited("8", "diamonds"),
          wild("6"),
        ],
        "6",
      ),
    ).toEqual({ kind: "full-house", size: 5, rank: "Q" });
  });

  it("completes straight and A2345 low straight", () => {
    expect(
      classifyHandWithLevel(
        [suited("7"), suited("8"), suited("9"), suited("J"), wild("6")],
        "6",
      ),
    ).toEqual({ kind: "straight", size: 5, highRank: "J" });

    expect(
      classifyHandWithLevel(
        [suited("A"), suited("2"), suited("3"), suited("5"), wild("6")],
        "6",
      ),
    ).toEqual({ kind: "straight", size: 5, highRank: "5" });
  });

  it("completes straight flush with a wildcard taking the missing suited card", () => {
    expect(
      classifyHandWithLevel(
        [
          suited("7", "spades"),
          suited("8", "spades"),
          suited("9", "spades"),
          suited("J", "spades"),
          wild("6"),
        ],
        "6",
      ),
    ).toEqual({ kind: "straight-flush", size: 5, highRank: "J" });
  });

  it("completes consecutive pairs and consecutive triples", () => {
    expect(
      classifyHandWithLevel(
        [
          suited("7"),
          suited("7", "spades"),
          suited("8"),
          suited("8", "diamonds"),
          suited("9"),
          wild("6"),
        ],
        "6",
      ),
    ).toEqual({ kind: "consecutive-pairs", size: 6, highRank: "9" });

    expect(
      classifyHandWithLevel(
        [
          suited("10"),
          suited("10", "spades"),
          suited("10", "diamonds"),
          suited("J"),
          suited("J", "spades"),
          wild("6"),
        ],
        "6",
      ),
    ).toEqual({ kind: "consecutive-triples", size: 6, highRank: "J" });
  });

  it("does not treat jokers or non-heart level cards as wildcards", () => {
    expect(
      classifyHandWithLevel([suited("9"), suited("6", "clubs")], "6").kind,
    ).toBe("invalid");
    expect(
      classifyHandWithLevel(
        [suited("9"), { kind: "joker", size: "small" }],
        "6",
      ).kind,
    ).toBe("invalid");
  });
});
