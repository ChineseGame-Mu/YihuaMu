import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  completeTableOpeningDraw,
  createTableRoundState,
  passTableTurn,
  playTableCards,
} from "../src/core/table-state-machine.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

const KEEP_ORDER = (): number => 0.999999;
const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
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

const fiveNineBomb: Card[] = [
  suited("9", "clubs"),
  suited("9", "diamonds"),
  suited("9", "hearts"),
  suited("9", "spades"),
  suited("9", "clubs"),
];

const levelWildcardStraightFlush: Card[] = [
  suited("3", "hearts"),
  suited("4", "hearts"),
  suited("5", "hearts"),
  suited("6", "hearts"),
  suited("2", "hearts"),
];

describe("opening draw to wildcard bomb table matrix", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "keeps opening winner, classifies the level wildcard straight flush, and closes the trick at %i players",
    (playerCount) => {
      let state = completeTableOpeningDraw(
        createTableRoundState(
          openingDeck(playerCount),
          playerCount,
          KEEP_ORDER,
        ),
      );

      expect(state.openingDraw.winnerSeat).toBe(0);
      expect(state.levelRank).toBe("2");
      expect(state.trick?.currentTurn).toBe(0);

      state = playTableCards(state, 0, fiveNineBomb);
      expect(state.trick?.leadingPlay?.hand).toMatchObject({
        kind: "bomb",
        size: 5,
        rank: "9",
      });
      expect(state.trick?.currentTurn).toBe(1);

      state = playTableCards(state, 1, levelWildcardStraightFlush);
      expect(state.trick?.leadingPlay?.hand).toMatchObject({
        kind: "straight-flush",
        size: 5,
        highRank: "7",
      });
      expect(state.trick?.leaderSeat).toBe(1);

      for (let seat = 2; seat < playerCount; seat += 1) {
        state = passTableTurn(state, seat);
      }
      state = passTableTurn(state, 0);

      expect(state.trick?.leadingPlay).toBeNull();
      expect(state.trick?.leaderSeat).toBe(1);
      expect(state.trick?.currentTurn).toBe(1);
      expect(state.trick?.completedTricks).toBe(1);
      expect(state.trick?.passedSeats).toEqual([]);
      expect(state.levelRank).toBe("2");
    },
  );
});
