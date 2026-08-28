import { describe, expect, it } from "vitest";
import { createDeck } from "../src/core/deck.js";
import { runOpeningDraw } from "../src/core/opening-draw.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const PLAYER_COUNTS = [4, 6, 8, 10, 12, 14] as const;

describe("opening draw exhaustion safety", () => {
  it.each(PLAYER_COUNTS)(
    "fails cleanly instead of selecting an ambiguous winner for %i players",
    (playerCount: SupportedPlayerCount) => {
      const deck = createDeck(playerCount);
      const alwaysLast = () => 0.999999;

      expect(() => runOpeningDraw(deck, playerCount, alwaysLast)).toThrow(
        "opening draw exhausted before a unique winner was found",
      );
    },
  );

  it.each(PLAYER_COUNTS)(
    "never mutates the formal deck when an opening draw exhausts for %i players",
    (playerCount: SupportedPlayerCount) => {
      const deck = createDeck(playerCount);
      const snapshot = deck.map(({ id }) => id);

      expect(() => runOpeningDraw(deck, playerCount, () => 0.999999)).toThrow();
      expect(deck.map(({ id }) => id)).toEqual(snapshot);
    },
  );
});
