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
const keepDeckOrder = (): number => 0.999999;

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

const fiveCardBomb: readonly Card[] = Array.from({ length: 5 }, (_, index) =>
  suited(
    "9",
    (["clubs", "diamonds", "hearts", "spades", "clubs"] as const)[index]!,
  ),
);

const wildcardStraightFlush: readonly Card[] = [
  suited("8", "spades"),
  suited("9", "spades"),
  suited("10", "spades"),
  suited("J", "spades"),
  suited(LEVEL_RANK, "hearts"),
];

const sixCardBomb: readonly Card[] = Array.from({ length: 6 }, (_, index) =>
  suited(
    "10",
    (["clubs", "diamonds", "hearts", "spades", "clubs", "diamonds"] as const)[
      index
    ]!,
  ),
);

const jokerBomb: readonly Card[] = [
  { kind: "joker", size: "small" },
  { kind: "joker", size: "small" },
  { kind: "joker", size: "big" },
  { kind: "joker", size: "big" },
];

describe("complete bomb hierarchy response chain", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "carries opening draw through five-bomb, straight-flush, six-bomb, joker-bomb, and trick closure for %i players",
    (playerCount) => {
      let state = completeTableOpeningDraw(
        createTableRoundState(
          openingDeck(playerCount),
          playerCount,
          keepDeckOrder,
          LEVEL_RANK,
        ),
      );

      expect(state.openingDraw.winnerSeat).toBe(0);
      expect(classifyHandWithLevel(fiveCardBomb, LEVEL_RANK)).toMatchObject({
        kind: "bomb",
        size: 5,
      });
      expect(
        classifyHandWithLevel(wildcardStraightFlush, LEVEL_RANK),
      ).toMatchObject({ kind: "straight-flush", size: 5 });
      expect(classifyHandWithLevel(sixCardBomb, LEVEL_RANK)).toMatchObject({
        kind: "bomb",
        size: 6,
      });
      expect(classifyHandWithLevel(jokerBomb, LEVEL_RANK)).toMatchObject({
        kind: "joker-bomb",
        size: 4,
      });

      state = playTableCards(state, 0, fiveCardBomb);
      expect(state.trick?.leadingPlay?.hand.kind).toBe("bomb");

      state = playTableCards(state, 1, wildcardStraightFlush);
      expect(state.trick?.leadingPlay?.hand.kind).toBe("straight-flush");

      state = playTableCards(state, 2, sixCardBomb);
      expect(state.trick?.leadingPlay?.hand.kind).toBe("bomb");
      expect(state.trick?.leadingPlay?.hand.size).toBe(6);

      state = playTableCards(state, 3, jokerBomb);
      expect(state.trick?.leadingPlay?.seat).toBe(3);
      expect(state.trick?.leadingPlay?.hand.kind).toBe("joker-bomb");
      expect(state.levelRank).toBe(LEVEL_RANK);

      for (let offset = 1; offset < playerCount; offset += 1) {
        const seat = (3 + offset) % playerCount;
        expect(state.trick?.currentTurn).toBe(seat);
        state = passTableTurn(state, seat);
      }

      expect(state.trick?.leadingPlay).toBeNull();
      expect(state.trick?.passedSeats).toEqual([]);
      expect(state.trick?.completedTricks).toBe(1);
      expect(state.trick?.leaderSeat).toBe(3);
      expect(state.trick?.currentTurn).toBe(3);
      expect(state.levelRank).toBe(LEVEL_RANK);
    },
  );
});
