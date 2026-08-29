import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import type { SupportedPlayerCount } from "../src/core/table.js";
import {
  passTableTurn,
  playTableCardsWithLevel,
  type TableRoundState,
} from "../src/core/table-state-machine.js";
import { createTrickState } from "../src/core/trick-state.js";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const wild = (levelRank: Rank): Card => suited(levelRank, "hearts");

const playingState = (
  playerCount: SupportedPlayerCount,
  activeSeats: readonly number[] = Array.from(
    { length: playerCount },
    (_, seat) => seat,
  ),
  finishingOrder: readonly number[] = [],
): TableRoundState => ({
  playerCount,
  phase: "playing",
  openingDraw: { remainingCards: [], attempts: [], winnerSeat: 0 },
  trick: createTrickState(playerCount, 0),
  activeSeats,
  finishingOrder,
});

const wildcardStraight = (): Card[] => [
  suited("7"),
  suited("8", "diamonds"),
  suited("9"),
  suited("J"),
  wild("6"),
];

describe("level-aware table state machine", () => {
  it.each([4, 6, 8, 10, 12, 14] as const)(
    "keeps wildcard classification and table rotation aligned for %i players",
    (playerCount) => {
      const state = playTableCardsWithLevel(
        playingState(playerCount),
        0,
        wildcardStraight(),
        "6",
      );

      expect(state.phase).toBe("playing");
      expect(state.trick?.leadingPlay?.hand).toEqual({
        kind: "straight",
        size: 5,
        highRank: "J",
      });
      expect(state.trick?.leaderSeat).toBe(0);
      expect(state.trick?.currentTurn).toBe(1);
      expect(state.activeSeats).toHaveLength(playerCount);
    },
  );

  it("removes a wildcard leader who finishes and lets the teammate catch after opponents pass", () => {
    let state = playTableCardsWithLevel(
      playingState(4),
      0,
      wildcardStraight(),
      "6",
      { finishesHand: true },
    );

    expect(state.activeSeats).toEqual([1, 2, 3]);
    expect(state.finishingOrder).toEqual([0]);
    expect(state.trick?.currentTurn).toBe(1);

    state = passTableTurn(state, 1);
    state = passTableTurn(state, 3);

    expect(state.trick?.leadingPlay).toBeNull();
    expect(state.trick?.completedTricks).toBe(1);
    expect(state.trick?.leaderSeat).toBe(2);
    expect(state.trick?.currentTurn).toBe(2);
  });

  it("completes the round when a level-wildcard play leaves one active seat", () => {
    const state = playTableCardsWithLevel(
      playingState(4, [0, 1], [2, 3]),
      0,
      [suited("Q"), suited("Q", "diamonds"), suited("Q", "spades"), wild("6")],
      "6",
      { finishesHand: true },
    );

    expect(state.phase).toBe("round-complete");
    expect(state.activeSeats).toEqual([1]);
    expect(state.finishingOrder).toEqual([2, 3, 0, 1]);
    expect(state.trick?.leadingPlay?.hand).toEqual({
      kind: "bomb",
      size: 4,
      rank: "Q",
    });
  });
});
