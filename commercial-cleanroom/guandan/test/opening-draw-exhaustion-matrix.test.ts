import { describe, expect, it } from "vitest";
import type { DeckCard } from "../src/core/deck.js";
import { runOpeningDraw } from "../src/core/opening-draw.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const PLAYER_COUNTS = [4, 6, 8, 10, 12, 14] as const;

const tiedDeck = (playerCount: SupportedPlayerCount): DeckCard[] =>
  Array.from({ length: playerCount * 2 }, (_, index) => ({
    id: `tie:${index}`,
    copy: index,
    card: { kind: "suited", suit: "clubs", rank: "A" },
  }));

describe("opening draw exhaustion safety", () => {
  it.each(PLAYER_COUNTS)(
    "fails cleanly instead of selecting an ambiguous winner for %i players",
    (playerCount: SupportedPlayerCount) => {
      const deck = tiedDeck(playerCount);

      expect(() => runOpeningDraw(deck, playerCount, () => 0.5)).toThrow(
        "opening draw exhausted before a unique winner was found",
      );
    },
  );

  it.each(PLAYER_COUNTS)(
    "never mutates the supplied deck when an opening draw exhausts for %i players",
    (playerCount: SupportedPlayerCount) => {
      const deck = tiedDeck(playerCount);
      const snapshot = deck.map(({ id }) => id);

      expect(() => runOpeningDraw(deck, playerCount, () => 0.5)).toThrow();
      expect(deck.map(({ id }) => id)).toEqual(snapshot);
    },
  );
});
