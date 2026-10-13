import { describe, expect, it } from "vitest";
import { RANKS, SUITS, type Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import { runOpeningDraw } from "../src/core/opening-draw.js";
import {
  SUPPORTED_PLAYER_COUNTS,
  type SupportedPlayerCount,
} from "../src/core/table.js";

const suitedCardsDescending: Extract<Card, { kind: "suited" }>[] = [...RANKS]
  .reverse()
  .flatMap((rank) =>
    [...SUITS]
      .reverse()
      .map((suit) => ({ kind: "suited" as const, rank, suit })),
  );

const deckFor = (playerCount: SupportedPlayerCount): DeckCard[] =>
  suitedCardsDescending.slice(0, playerCount).map((card, seat) => ({
    id: `opening-${playerCount}-${seat}`,
    copy: 0,
    card,
  }));

const keepOrder = () => 0.999999;

describe("opening draw supported player counts", () => {
  for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
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
