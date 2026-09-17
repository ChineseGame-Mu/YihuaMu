import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import { classifyHandWithLevel } from "../src/core/level-hand.js";
import {
  completeTableOpeningDraw,
  createTableRoundState,
  passTableTurn,
  playTableCards,
} from "../src/core/table-state-machine.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

const LEVEL_RANK: Rank = "7";
const KEEP_ORDER = (): number => 0.999999;

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});

const redrawDeck = (playerCount: number): DeckCard[] => [
  ...Array.from({ length: playerCount }, (_, seat) => ({
    id: `tie:${seat}`,
    copy: 0,
    card: suited("A", seat % 2 === 0 ? "clubs" : "diamonds"),
  })),
  ...Array.from({ length: playerCount }, (_, seat) => ({
    id: `winner:${seat}`,
    copy: 0,
    card: suited(seat === 0 ? "A" : "3", seat === 0 ? "hearts" : "clubs"),
  })),
];

const wildcardStraightFlush: readonly Card[] = [
  suited("8", "spades"),
  suited("9", "spades"),
  suited("10", "spades"),
  suited("J", "spades"),
  suited(LEVEL_RANK, "hearts"),
];

describe("opening redraw to wildcard finished-leader catch matrix", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "redraws a tied opening, applies level wildcard judgment, then catches the lead for %i players",
    (playerCount) => {
      let state = completeTableOpeningDraw(
        createTableRoundState(
          redrawDeck(playerCount),
          playerCount,
          KEEP_ORDER,
          LEVEL_RANK,
        ),
      );

      expect(state.openingDraw.attempts).toHaveLength(2);
      expect(state.openingDraw.attempts[0]?.winnerSeat).toBeNull();
      expect(state.openingDraw.attempts[1]?.winnerSeat).toBe(0);
      expect(state.openingDraw.winnerSeat).toBe(0);
      expect(state.trick?.leaderSeat).toBe(0);
      expect(state.trick?.currentTurn).toBe(0);
      expect(
        classifyHandWithLevel(wildcardStraightFlush, LEVEL_RANK),
      ).toMatchObject({
        kind: "straight-flush",
        size: 5,
      });

      state = playTableCards(state, 0, wildcardStraightFlush, {
        finishesHand: true,
      });

      expect(state.finishingOrder).toEqual([0]);
      expect(state.activeSeats).not.toContain(0);
      expect(state.trick?.leadingPlay?.seat).toBe(0);
      expect(state.trick?.leadingPlay?.hand.kind).toBe("straight-flush");

      const opponentSeats = Array.from(
        { length: playerCount / 2 },
        (_, index) => index * 2 + 1,
      );
      for (const seat of opponentSeats) {
        expect(state.trick?.currentTurn).toBe(seat);
        state = passTableTurn(state, seat);
      }

      expect(state.trick?.leadingPlay).toBeNull();
      expect(state.trick?.passedSeats).toEqual([]);
      expect(state.trick?.completedTricks).toBe(1);
      expect(state.trick?.leaderSeat).toBe(2);
      expect(state.trick?.currentTurn).toBe(2);
      expect(state.levelRank).toBe(LEVEL_RANK);
    },
  );
});
