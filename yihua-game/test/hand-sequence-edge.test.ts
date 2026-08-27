import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { classifyHand } from "../src/core/hand.js";

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});

describe("sequence boundaries", () => {
  it("allows A2345 as the only five-card straight containing rank 2", () => {
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
        suited("2", "clubs"),
        suited("3", "diamonds"),
        suited("4", "spades"),
        suited("5", "hearts"),
        suited("6", "clubs"),
      ]).kind,
    ).toBe("invalid");
  });
});
