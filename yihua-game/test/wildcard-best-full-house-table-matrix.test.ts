import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import { classifyHandWithLevel } from "../src/core/level-hand.js";
import {
  completeTableOpeningDraw,
  createTableRoundState,
  playTableCards,
} from "../src/core/table-state-machine.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

const KEEP_ORDER = (): number => 0.999999;
const LEVEL: Rank = "7";

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});

const openingDeck = (playerCount: number): DeckCard[] =>
  Array.from({ length: playerCount }, (_, seat) => ({
    id: `opening:${seat}`,
    copy: 0,
    card: suited(seat === 0 ? "A" : "3", seat === 0 ? "hearts" : "clubs"),
  }));

const lowerFullHouse: Card[] = [
  suited("8", "clubs"),
  suited("8", "diamonds"),
  suited("8", "spades"),
  suited("3", "clubs"),
  suited("3", "diamonds"),
];

const naturalSevenFullHouse: Card[] = [
  suited("7", "hearts"),
  suited("7", "clubs"),
  suited("7", "diamonds"),
  suited("9", "clubs"),
  suited("9", "diamonds"),
];

describe("best wildcard full-house interpretation", () => {
  it("uses the level wildcard for the strongest legal triple rank", () => {
    expect(classifyHandWithLevel(naturalSevenFullHouse, LEVEL)).toEqual({
      kind: "full-house",
      size: 5,
      rank: "9",
    });
  });

  it.each(SUPPORTED_PLAYER_COUNTS)(
    "feeds the stronger wildcard full house into table comparison at %i seats",
    (playerCount) => {
      const playing = completeTableOpeningDraw(
        createTableRoundState(
          openingDeck(playerCount),
          playerCount,
          KEEP_ORDER,
          LEVEL,
        ),
      );

      const led = playTableCards(playing, 0, lowerFullHouse);
      expect(led.trick?.leadingPlay?.hand).toEqual({
        kind: "full-house",
        size: 5,
        rank: "8",
      });

      const beaten = playTableCards(led, 1, naturalSevenFullHouse);
      expect(beaten.trick?.leadingPlay).toMatchObject({
        seat: 1,
        hand: {
          kind: "full-house",
          size: 5,
          rank: "9",
        },
      });
      expect(beaten.trick?.currentTurn).toBe(2 % playerCount);
      expect(beaten.levelRank).toBe(LEVEL);
    },
  );
});
