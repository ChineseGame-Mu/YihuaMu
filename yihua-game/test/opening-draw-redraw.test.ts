import { describe, expect, it } from "vitest";
import type { DeckCard } from "../src/core/deck.js";
import { runOpeningDraw } from "../src/core/opening-draw.js";

const suited = (
  id: string,
  copy: number,
  rank: "3" | "4" | "5" | "6" | "7" | "A",
  suit: "clubs" | "spades" | "hearts",
): DeckCard => ({
  id,
  copy,
  card: { kind: "suited", rank, suit },
});

describe("opening draw redraw", () => {
  it("redraws all seats after a tied highest card and ignores jokers", () => {
    const deck: DeckCard[] = [
      suited("0:hearts:A", 0, "A", "hearts"),
      suited("1:hearts:A", 1, "A", "hearts"),
      suited("0:clubs:3", 0, "3", "clubs"),
      suited("0:clubs:4", 0, "4", "clubs"),
      suited("0:clubs:5", 0, "5", "clubs"),
      suited("0:clubs:6", 0, "6", "clubs"),
      suited("0:clubs:7", 0, "7", "clubs"),
      suited("0:spades:A", 0, "A", "spades"),
      { id: "0:joker:small", copy: 0, card: { kind: "joker", size: "small" } },
      { id: "0:joker:big", copy: 0, card: { kind: "joker", size: "big" } },
    ];

    const result = runOpeningDraw(deck, 4, () => 0.999);

    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]?.winnerSeat).toBeNull();
    expect(result.attempts[1]?.winnerSeat).toBe(3);
    expect(result.winnerSeat).toBe(3);
    expect(
      result.attempts.every((attempt) =>
        attempt.cards.every(({ card }) => card.kind === "suited"),
      ),
    ).toBe(true);
  });
});
