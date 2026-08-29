import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { classifyHand } from "../src/core/hand.js";
import { createTrickState, passTurn, playCards } from "../src/core/trick-state.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const repeated = (rank: Rank, count: number): Card[] =>
  Array.from({ length: count }, () => suited(rank));

const legalHands: readonly [string, readonly Card[]][] = [
  ["single", [suited("7")]],
  ["pair", repeated("7", 2)],
  ["triple", repeated("7", 3)],
  ["full-house", [...repeated("7", 3), ...repeated("8", 2)]],
  [
    "straight",
    [suited("3", "clubs"), suited("4", "diamonds"), suited("5", "hearts"), suited("6", "spades"), suited("7", "clubs")],
  ],
  [
    "straight-flush",
    [suited("3", "hearts"), suited("4", "hearts"), suited("5", "hearts"), suited("6", "hearts"), suited("7", "hearts")],
  ],
  [
    "consecutive-pairs",
    [...repeated("3", 2), ...repeated("4", 2), ...repeated("5", 2)],
  ],
  ["consecutive-triples", [...repeated("3", 3), ...repeated("4", 3)]],
  ["bomb", repeated("9", 4)],
  [
    "joker-bomb",
    [
      { kind: "joker", size: "small" },
      { kind: "joker", size: "small" },
      { kind: "joker", size: "big" },
      { kind: "joker", size: "big" },
    ],
  ],
];

describe("complete hand and trick matrix across every supported table size", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "accepts every supported hand kind and closes a trick correctly for %i players",
    (playerCount) => {
      for (const [kind, cards] of legalHands) {
        expect(classifyHand(cards).kind).toBe(kind);
      }

      let state = playCards(
        createTrickState(playerCount, playerCount - 1),
        playerCount - 1,
        [suited("7")],
      );

      expect(state.currentTurn).toBe(0);
      expect(state.leaderSeat).toBe(playerCount - 1);

      for (let seat = 0; seat < playerCount - 1; seat += 1) {
        state = passTurn(state, seat);
      }

      expect(state.leadingPlay).toBeNull();
      expect(state.currentTurn).toBe(playerCount - 1);
      expect(state.leaderSeat).toBe(playerCount - 1);
      expect(state.completedTricks).toBe(1);
      expect(state.passedSeats).toEqual([]);
    },
  );
});
