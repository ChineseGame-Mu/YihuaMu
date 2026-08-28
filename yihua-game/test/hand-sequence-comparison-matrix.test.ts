import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";

type SuitedCard = Extract<Card, { readonly kind: "suited" }>;

const suited = (rank: SuitedCard["rank"], suit: SuitedCard["suit"]): Card => ({
  kind: "suited",
  rank,
  suit,
});

const hand = (cards: readonly Card[]) => classifyHand(cards);

describe("sequence comparison matrix", () => {
  it("compares ordinary straights by high rank, including wheel A2345", () => {
    const wheel = hand([
      suited("A", "clubs"),
      suited("2", "diamonds"),
      suited("3", "hearts"),
      suited("4", "spades"),
      suited("5", "clubs"),
    ]);
    const sixHigh = hand([
      suited("2", "clubs"),
      suited("3", "diamonds"),
      suited("4", "hearts"),
      suited("5", "spades"),
      suited("6", "clubs"),
    ]);
    const sevenHigh = hand([
      suited("3", "clubs"),
      suited("4", "diamonds"),
      suited("5", "hearts"),
      suited("6", "spades"),
      suited("7", "clubs"),
    ]);

    expect(wheel).toMatchObject({ kind: "straight", highRank: "5" });
    expect(sixHigh.kind).toBe("invalid");
    expect(sevenHigh).toMatchObject({ kind: "straight", highRank: "7" });
    expect(canHandBeat(sevenHigh, wheel)).toBe(true);
    expect(canHandBeat(wheel, sevenHigh)).toBe(false);
  });

  it("compares straight flushes within their bomb tier by high rank", () => {
    const sixHigh = hand([
      suited("2", "hearts"),
      suited("3", "hearts"),
      suited("4", "hearts"),
      suited("5", "hearts"),
      suited("6", "hearts"),
    ]);
    const nineHigh = hand([
      suited("5", "spades"),
      suited("6", "spades"),
      suited("7", "spades"),
      suited("8", "spades"),
      suited("9", "spades"),
    ]);

    expect(sixHigh.kind).toBe("invalid");
    expect(nineHigh).toMatchObject({ kind: "straight-flush", highRank: "9" });
  });

  it("compares consecutive pairs and triples by their sequence high rank", () => {
    const lowPairs = hand([
      suited("3", "clubs"),
      suited("3", "diamonds"),
      suited("4", "clubs"),
      suited("4", "diamonds"),
      suited("5", "clubs"),
      suited("5", "diamonds"),
    ]);
    const highPairs = hand([
      suited("4", "clubs"),
      suited("4", "diamonds"),
      suited("5", "clubs"),
      suited("5", "diamonds"),
      suited("6", "clubs"),
      suited("6", "diamonds"),
    ]);
    const lowTriples = hand([
      suited("7", "clubs"),
      suited("7", "diamonds"),
      suited("7", "hearts"),
      suited("8", "clubs"),
      suited("8", "diamonds"),
      suited("8", "hearts"),
    ]);
    const highTriples = hand([
      suited("8", "clubs"),
      suited("8", "diamonds"),
      suited("8", "hearts"),
      suited("9", "clubs"),
      suited("9", "diamonds"),
      suited("9", "hearts"),
    ]);

    expect(canHandBeat(highPairs, lowPairs)).toBe(true);
    expect(canHandBeat(lowPairs, highPairs)).toBe(false);
    expect(canHandBeat(highTriples, lowTriples)).toBe(true);
    expect(canHandBeat(lowTriples, highTriples)).toBe(false);
    expect(canHandBeat(highPairs, lowTriples)).toBe(false);
  });
});
