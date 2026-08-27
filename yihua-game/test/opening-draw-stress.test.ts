import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import { runOpeningDraw } from "../src/core/opening-draw.js";

const card = (id: string, value: Card): DeckCard => ({
  id,
  copy: 0,
  card: value,
});

const suited = (
  id: string,
  rank: Extract<Card, { kind: "suited" }>["rank"],
  suit: Extract<Card, { kind: "suited" }>["suit"],
): DeckCard => card(id, { kind: "suited", rank, suit });

const joker = (id: string, size: "small" | "big"): DeckCard =>
  card(id, { kind: "joker", size });

const keepOrder = () => 0.999999;

describe("opening draw stress boundaries", () => {
  it("excludes jokers, redraws after a tie, and returns one unique winner", () => {
    const deck: DeckCard[] = [
      joker("small-joker", "small"),
      suited("tie-a", "A", "hearts"),
      suited("tie-b", "A", "hearts"),
      suited("tie-k", "K", "clubs"),
      suited("tie-q", "Q", "clubs"),
      joker("big-joker", "big"),
      suited("win-10", "10", "clubs"),
      suited("win-j", "J", "clubs"),
      suited("win-q", "Q", "clubs"),
      suited("win-k", "K", "clubs"),
    ];

    const result = runOpeningDraw(deck, 4, keepOrder);

    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]!.winnerSeat).toBeNull();
    expect(result.attempts[1]!.winnerSeat).toBe(3);
    expect(result.winnerSeat).toBe(3);
    expect(
      result.attempts
        .flatMap(({ cards }) => cards)
        .every(({ card }) => card.kind === "suited"),
    ).toBe(true);
  });

  it("fails explicitly if every complete draw remains tied", () => {
    const deck: DeckCard[] = [
      suited("a-1", "A", "hearts"),
      suited("a-2", "A", "hearts"),
      suited("k-1", "K", "clubs"),
      suited("q-1", "Q", "clubs"),
      suited("j-1", "J", "spades"),
      suited("j-2", "J", "spades"),
      suited("10-1", "10", "clubs"),
      suited("9-1", "9", "clubs"),
    ];

    expect(() => runOpeningDraw(deck, 4, keepOrder)).toThrow(
      "opening draw exhausted before a unique winner was found",
    );
  });
});
