import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import { runOpeningDraw } from "../src/core/opening-draw.js";

const deckCard = (id: string, card: Card): DeckCard => ({ id, copy: 0, card });

const suited = (
  rank: Extract<Card, { kind: "suited" }>["rank"],
  suit: Extract<Card, { kind: "suited" }>["suit"],
): Card => ({ kind: "suited", rank, suit });

describe("opening draw tie redeal", () => {
  it("ignores jokers and redraws all seats after a tied highest card", () => {
    const deck: DeckCard[] = [
      deckCard("joker-small", { kind: "joker", size: "small" }),
      deckCard("tie-a-1", suited("A", "hearts")),
      deckCard("tie-a-2", suited("A", "hearts")),
      deckCard("tie-q", suited("Q", "spades")),
      deckCard("tie-j", suited("J", "diamonds")),
      deckCard("winner-k", suited("K", "hearts")),
      deckCard("second-q", suited("Q", "hearts")),
      deckCard("second-j", suited("J", "hearts")),
      deckCard("second-10", suited("10", "hearts")),
      deckCard("joker-big", { kind: "joker", size: "big" }),
    ];

    const result = runOpeningDraw(deck, 4, () => 0.999999);

    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]?.winnerSeat).toBeNull();
    expect(result.attempts[0]?.cards.map(({ id }) => id)).toEqual([
      "tie-a-1",
      "tie-a-2",
      "tie-q",
      "tie-j",
    ]);
    expect(result.attempts[1]?.cards.map(({ id }) => id)).toEqual([
      "winner-k",
      "second-q",
      "second-j",
      "second-10",
    ]);
    expect(result.winnerSeat).toBe(0);
  });
});
