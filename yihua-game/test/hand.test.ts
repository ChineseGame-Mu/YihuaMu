import { describe, expect, it } from "vitest";
import { classifyHand } from "../src/core/hand.js";
import type { Card } from "../src/core/cards.js";

const suited = (rank: "2" | "3" | "A", suit: "clubs" | "diamonds" | "spades" | "hearts"): Card => ({ kind: "suited", rank, suit });

describe("classifyHand", () => {
  it("classifies singles, pairs, triples and bombs", () => {
    expect(classifyHand([suited("A", "clubs")]).kind).toBe("single");
    expect(classifyHand([suited("3", "clubs"), suited("3", "hearts")]).kind).toBe("pair");
    expect(classifyHand([suited("2", "clubs"), suited("2", "diamonds"), suited("2", "hearts")]).kind).toBe("triple");
    expect(classifyHand([suited("A", "clubs"), suited("A", "diamonds"), suited("A", "spades"), suited("A", "hearts")]).kind).toBe("bomb");
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
    expect(classifyHand([suited("2", "clubs"), suited("3", "clubs")]).kind).toBe("invalid");
  });
});
