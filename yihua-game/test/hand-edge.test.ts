import { describe, expect, it } from "vitest";
import type { Card, Rank } from "../src/core/cards.js";
import { canBeat } from "../src/core/hand.js";

const cards = (ranks: readonly Rank[]): Card[] =>
  ranks.map((rank, index) => ({
    kind: "suited",
    rank,
    suit: (["clubs", "diamonds", "spades", "hearts"] as const)[index % 4]!,
  }));

describe("hand comparison edges", () => {
  it("does not allow equal-strength ordinary hands to beat each other", () => {
    expect(
      canBeat(
        cards(["8", "9", "10", "J", "Q"]),
        cards(["8", "9", "10", "J", "Q"]),
      ),
    ).toBe(false);
  });

  it("treats A2345 as the lowest straight", () => {
    expect(
      canBeat(
        cards(["2", "3", "4", "5", "6"]),
        cards(["A", "2", "3", "4", "5"]),
      ),
    ).toBe(true);
    expect(
      canBeat(
        cards(["A", "2", "3", "4", "5"]),
        cards(["2", "3", "4", "5", "6"]),
      ),
    ).toBe(false);
  });
});
