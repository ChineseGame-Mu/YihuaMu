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

const lowerStraightFlush: Card[] = [
  suited("3", "clubs"),
  suited("4", "clubs"),
  suited("5", "clubs"),
  suited("6", "clubs"),
  suited("7", "clubs"),
];

const wildcardStraightFlush: Card[] = [
  suited("4", "spades"),
  suited("5", "spades"),
  suited("6", "spades"),
  suited("7", "hearts"),
  suited("8", "spades"),
];

describe("opening draw + level hand judgment + table state matrix", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "connects all three clean-room stages for %i players",
    (playerCount) => {
      const playing = completeTableOpeningDraw(
        createTableRoundState(
          openingDeck(playerCount),
          playerCount,
          KEEP_ORDER,
          LEVEL,
        ),
      );

      expect(playing.phase).toBe("playing");
      expect(playing.openingDraw.winnerSeat).toBe(0);
      expect(playing.trick?.currentTurn).toBe(0);
      expect(playing.levelRank).toBe(LEVEL);

      expect(classifyHandWithLevel(wildcardStraightFlush, LEVEL)).toEqual({
        kind: "straight-flush",
        size: 5,
        highRank: "8",
      });

      const led = playTableCards(playing, 0, lowerStraightFlush);
      const beaten = playTableCards(led, 1, wildcardStraightFlush);

      expect(beaten.trick?.leadingPlay?.seat).toBe(1);
      expect(beaten.trick?.leadingPlay?.hand).toEqual({
        kind: "straight-flush",
        size: 5,
        highRank: "8",
      });
      expect(beaten.trick?.currentTurn).toBe(2 % playerCount);
      expect(beaten.activeSeats).toHaveLength(playerCount);
      expect(beaten.finishingOrder).toEqual([]);
    },
  );
});
