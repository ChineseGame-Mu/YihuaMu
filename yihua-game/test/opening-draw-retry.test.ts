import { describe, expect, it } from "vitest";
import type { DeckCard } from "../src/core/deck.js";
import { runOpeningDraw } from "../src/core/opening-draw.js";

const suited = (
  id: string,
  copy: number,
  rank: "2" | "3" | "4" | "5" | "Q" | "K" | "A",
  suit: "clubs" | "diamonds" | "spades" | "hearts",
): DeckCard => ({ id, copy, card: { kind: "suited", rank, suit } });

const joker = (id: string, copy: number, size: "small" | "big"): DeckCard => ({
  id,
  copy,
  card: { kind: "joker", size },
});

const preserveOrderRandom = (): number => 0.999;

describe("opening draw retry state", () => {
  it("retries after a tied maximum and resolves the next attempt from seat zero", () => {
    const deck: DeckCard[] = [
      suited("0:a-h", 0, "A", "hearts"),
      suited("1:a-h", 1, "A", "hearts"),
      suited("0:2-c", 0, "2", "clubs"),
      suited("0:3-c", 0, "3", "clubs"),
      suited("0:q-c", 0, "Q", "clubs"),
      suited("0:k-d", 0, "K", "diamonds"),
      suited("0:5-s", 0, "5", "spades"),
      suited("0:4-h", 0, "4", "hearts"),
    ];

    const result = runOpeningDraw(deck, 4, preserveOrderRandom);

    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]?.winnerSeat).toBeNull();
    expect(result.attempts[1]?.winnerSeat).toBe(1);
    expect(result.winnerSeat).toBe(1);
  });

  it("excludes jokers from all opening-draw attempts", () => {
    const deck: DeckCard[] = [
      joker("0:small", 0, "small"),
      joker("0:big", 0, "big"),
      suited("0:2-c", 0, "2", "clubs"),
      suited("0:3-d", 0, "3", "diamonds"),
      suited("0:4-s", 0, "4", "spades"),
      suited("0:5-h", 0, "5", "hearts"),
    ];

    const result = runOpeningDraw(deck, 4, preserveOrderRandom);

    expect(result.attempts).toHaveLength(1);
    expect(result.winnerSeat).toBe(3);
    expect(
      result.attempts[0]?.cards.every(({ card }) => card.kind === "suited"),
    ).toBe(true);
  });
});
