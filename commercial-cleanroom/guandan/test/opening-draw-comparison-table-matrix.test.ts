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

const openingDeck = (playerCount: number): DeckCard[] =>
  Array.from({ length: playerCount }, (_, seat) => ({
    id: `opening:${seat}`,
    copy: 0,
    card: suited(seat === 0 ? "A" : "3", seat === 0 ? "spades" : "clubs"),
  }));

const lowPair: readonly Card[] = [
  suited("5", "clubs"),
  suited("5", "diamonds"),
];
const highPair: readonly Card[] = [
  suited("6", "clubs"),
  suited("6", "diamonds"),
];

describe("opening draw to compared-hand table rotation matrix", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "carries opening winner through hand comparison and completed trick for %i players",
    (playerCount) => {
      let state = completeTableOpeningDraw(
        createTableRoundState(
          openingDeck(playerCount),
          playerCount,
          KEEP_ORDER,
          LEVEL_RANK,
        ),
      );

      expect(state.openingDraw.winnerSeat).toBe(0);
      expect(state.trick?.currentTurn).toBe(0);
      expect(classifyHandWithLevel(lowPair, LEVEL_RANK)).toMatchObject({
        kind: "pair",
      });
      expect(classifyHandWithLevel(highPair, LEVEL_RANK)).toMatchObject({
        kind: "pair",
      });

      state = playTableCards(state, 0, lowPair);
      expect(state.trick?.leadingPlay?.seat).toBe(0);
      expect(state.trick?.currentTurn).toBe(1);

      state = playTableCards(state, 1, highPair);
      expect(state.trick?.leadingPlay?.seat).toBe(1);
      expect(state.trick?.leadingPlay?.hand.kind).toBe("pair");
      expect(state.trick?.currentTurn).toBe(2 % playerCount);

      const passingSeats = Array.from(
        { length: playerCount - 1 },
        (_, index) => (index + 2) % playerCount,
      ).filter((seat) => seat !== 1);
      for (const seat of passingSeats) {
        expect(state.trick?.currentTurn).toBe(seat);
        state = passTableTurn(state, seat);
      }

      expect(state.trick?.leadingPlay).toBeNull();
      expect(state.trick?.completedTricks).toBe(1);
      expect(state.trick?.leaderSeat).toBe(1);
      expect(state.trick?.currentTurn).toBe(1);
      expect(state.levelRank).toBe(LEVEL_RANK);
    },
  );
});
