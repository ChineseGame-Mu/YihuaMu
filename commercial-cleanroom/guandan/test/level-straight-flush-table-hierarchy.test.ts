import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { canHandBeatWithLevel, classifyHand } from "../src/core/hand.js";
import { classifyHandWithLevel } from "../src/core/level-hand.js";
import {
  playTableCardsWithLevel,
  type TableRoundState,
} from "../src/core/table-state-machine.js";
import { createTrickState } from "../src/core/trick-state.js";

const levelRank: Rank = "9";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const wildcardStraightFlush = (): Card[] => [
  suited("7", "spades"),
  suited("8", "spades"),
  suited(levelRank, "hearts"),
  suited("10", "spades"),
  suited("J", "spades"),
];

const bomb = (rank: Rank, size: number): Card[] =>
  Array.from({ length: size }, (_, index) =>
    suited(rank, index % 2 === 0 ? "clubs" : "diamonds"),
  );

const playingState = (): TableRoundState => ({
  playerCount: 4,
  levelRank,
  phase: "playing",
  openingDraw: { remainingCards: [], attempts: [], winnerSeat: 0 },
  trick: createTrickState(4, 0),
  activeSeats: [0, 1, 2, 3],
  finishingOrder: [],
});

describe("level wildcard straight-flush hierarchy", () => {
  it("classifies a heart-level wildcard as the missing suited card", () => {
    expect(classifyHandWithLevel(wildcardStraightFlush(), levelRank)).toEqual({
      kind: "straight-flush",
      size: 5,
      highRank: "J",
    });
  });

  it("places wildcard straight flush above five-card bombs and below six-card bombs", () => {
    const straightFlush = classifyHandWithLevel(
      wildcardStraightFlush(),
      levelRank,
    );
    const fiveBomb = classifyHand(bomb("Q", 5));
    const sixBomb = classifyHand(bomb("3", 6));

    expect(canHandBeatWithLevel(straightFlush, fiveBomb, levelRank)).toBe(true);
    expect(canHandBeatWithLevel(fiveBomb, straightFlush, levelRank)).toBe(
      false,
    );
    expect(canHandBeatWithLevel(sixBomb, straightFlush, levelRank)).toBe(true);
    expect(canHandBeatWithLevel(straightFlush, sixBomb, levelRank)).toBe(false);
  });

  it("enforces the same hierarchy during live table overcalls", () => {
    let state = playTableCardsWithLevel(
      playingState(),
      0,
      bomb("Q", 5),
      levelRank,
    );

    state = playTableCardsWithLevel(
      state,
      1,
      wildcardStraightFlush(),
      levelRank,
    );

    expect(state.trick?.leadingPlay?.seat).toBe(1);
    expect(state.trick?.leadingPlay?.hand.kind).toBe("straight-flush");
    expect(state.trick?.currentTurn).toBe(2);

    state = playTableCardsWithLevel(state, 2, bomb("3", 6), levelRank);

    expect(state.trick?.leadingPlay?.seat).toBe(2);
    expect(state.trick?.leadingPlay?.hand).toMatchObject({
      kind: "bomb",
      size: 6,
      rank: "3",
    });
    expect(state.trick?.currentTurn).toBe(3);
  });
});
