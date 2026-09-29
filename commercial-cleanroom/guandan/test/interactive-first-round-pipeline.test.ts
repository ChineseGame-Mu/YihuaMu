import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { createLobbyState } from "../src/core/game-state.js";
import { classifyHand } from "../src/core/hand.js";
import {
  transitionInteractiveGame,
  type InteractiveGameState,
} from "../src/core/interactive-game-machine.js";
import { interactiveGameSnapshot } from "../src/core/interactive-game-snapshot.js";
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
    [
      suited("3", "clubs"),
      suited("4", "diamonds"),
      suited("5", "hearts"),
      suited("6", "spades"),
      suited("7", "clubs"),
    ],
  ],
  [
    "straight-flush",
    [
      suited("3", "hearts"),
      suited("4", "hearts"),
      suited("5", "hearts"),
      suited("6", "hearts"),
      suited("7", "hearts"),
    ],
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

const deterministicRandom = (): (() => number) => {
  let seed = 0x6d2b79f5;
  return () => {
    seed = Math.imul(seed ^ (seed >>> 15), seed | 1);
    seed ^= seed + Math.imul(seed ^ (seed >>> 7), seed | 61);
    return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
  };
};

describe("interactive first-round pipeline", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "runs opening draw, deals, and exposes a coherent table snapshot for %i players",
    (playerCount) => {
      const random = deterministicRandom();
      const lobby = createLobbyState(playerCount, 0);
      const state = transitionInteractiveGame(
        lobby,
        { type: "start-interactive-first-round" },
        random,
      ) as InteractiveGameState;

      expect(state.phase).toBe("playing");
      const snapshot = interactiveGameSnapshot(state);
      expect(snapshot.phase).toBe("playing");
      expect(snapshot.openingWinnerSeat).not.toBeNull();
      expect(snapshot.currentTurn).toBe(snapshot.openingWinnerSeat);
      expect(snapshot.leaderSeat).toBe(snapshot.openingWinnerSeat);
      expect(snapshot.handCounts).toHaveLength(playerCount);
      expect(snapshot.handCounts.every((count) => count > 0)).toBe(true);
      expect(snapshot.leadingPlay).toBeNull();
      expect(snapshot.leadingHand).toBeNull();
      expect(snapshot.completedTricks).toBe(0);
      expect(snapshot.finishedSeats).toEqual([]);

      for (const [kind, cards] of legalHands) {
        expect(classifyHand(cards).kind).toBe(kind);
      }
    },
  );
});
