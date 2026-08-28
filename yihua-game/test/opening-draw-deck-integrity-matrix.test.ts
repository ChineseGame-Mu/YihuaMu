import { describe, expect, it } from "vitest";
import { createDeck } from "../src/core/deck.js";
import { runOpeningDraw } from "../src/core/opening-draw.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const PLAYER_COUNTS = [4, 6, 8, 10, 12, 14] as const;

const constantRandom = () => 0;

describe("opening draw deck integrity matrix", () => {
  it.each(PLAYER_COUNTS)(
    "draws only ordinary cards without mutating the %i-player deck",
    (playerCount: SupportedPlayerCount) => {
      const deck = createDeck(playerCount);
      const before = deck.map((card) => card.id);
      const result = runOpeningDraw(deck, playerCount, constantRandom);

      expect(deck.map((card) => card.id)).toEqual(before);
      expect(result.attempts.length).toBeGreaterThan(0);
      expect(result.winnerSeat).toBeGreaterThanOrEqual(0);
      expect(result.winnerSeat).toBeLessThan(playerCount);

      for (const attempt of result.attempts) {
        expect(attempt.cards).toHaveLength(playerCount);
        expect(attempt.cards.every(({ card }) => card.kind === "suited")).toBe(true);
        expect(new Set(attempt.cards.map((card) => card.id)).size).toBe(playerCount);
      }
    },
  );
});
