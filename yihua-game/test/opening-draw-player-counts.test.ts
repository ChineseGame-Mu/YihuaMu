import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import { runOpeningDraw } from "../src/core/opening-draw.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const ranks: Extract<Card, { kind: "suited" }>["rank"][] = [
  "A",
  "K",
  "Q",
  "J",
  "10",
  "9",
];

const deckFor = (playerCount: SupportedPlayerCount): DeckCard[] =>
  ranks.slice(0, playerCount).map((rank, seat) => ({
    id: `opening-${playerCount}-${seat}`,
    copy: 0,
    card: { kind: "suited", rank, suit: "clubs" },
  }));

const keepOrder = () => 0.999999;

describe("opening draw supported player counts", () => {
  for (const playerCount of [2, 3, 4, 5, 6] as const) {
    it(`selects the unique highest card at a ${playerCount}-player table`, () => {
      const result = runOpeningDraw(
        deckFor(playerCount),
        playerCount,
        keepOrder,
      );

      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0]!.cards).toHaveLength(playerCount);
      expect(result.winnerSeat).toBe(0);
    });
  }
});
