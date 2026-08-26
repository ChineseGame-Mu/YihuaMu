import { describe, expect, it } from "vitest";

import {
  createDeck,
  dealHands,
  deckCopiesForTable,
  shuffleDeck,
} from "../src/core/deck.js";
import { CARDS_PER_PLAYER, SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

describe("independent deck core", () => {
  it("builds the exact number of cards for every supported table size", () => {
    for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
      const deck = createDeck(playerCount);
      expect(deckCopiesForTable(playerCount)).toBe(playerCount / 2);
      expect(deck).toHaveLength(playerCount * CARDS_PER_PLAYER);
      expect(new Set(deck.map(({ id }) => id)).size).toBe(deck.length);
    }
  });

  it("contains 52 suited cards and two jokers per physical copy", () => {
    const deck = createDeck(4);
    const suited = deck.filter(({ card }) => card.kind === "suited");
    const jokers = deck.filter(({ card }) => card.kind === "joker");

    expect(suited).toHaveLength(104);
    expect(jokers).toHaveLength(4);
  });

  it("deals exactly 27 cards to every seat", () => {
    for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
      const hands = dealHands(createDeck(playerCount), playerCount);
      expect(hands).toHaveLength(playerCount);
      expect(hands.every((hand) => hand.length === CARDS_PER_PLAYER)).toBe(true);
    }
  });

  it("shuffles without changing card identity", () => {
    const deck = createDeck(4);
    const shuffled = shuffleDeck(deck, () => 0);

    expect(shuffled).not.toEqual(deck);
    expect(shuffled.map(({ id }) => id).sort()).toEqual(
      deck.map(({ id }) => id).sort(),
    );
  });

  it("rejects a deck with the wrong size", () => {
    expect(() => dealHands(createDeck(4).slice(1), 4)).toThrow();
  });
});
