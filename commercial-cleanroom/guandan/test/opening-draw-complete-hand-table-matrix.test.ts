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

const repeated = (rank: Rank, count: number): Card[] =>
  Array.from({ length: count }, () => suited(rank));

const openingDeck = (playerCount: number): DeckCard[] =>
  Array.from({ length: playerCount }, (_, seat) => ({
    id: `opening:${seat}`,
    copy: 0,
    card: suited(seat === 0 ? "A" : "3", seat === 0 ? "hearts" : "clubs"),
  }));

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

describe("opening draw -> complete hand -> table state integration", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "carries every supported hand family through a complete table trick for %i players",
    (playerCount) => {
      for (const [kind, cards] of legalHands) {
        let state = completeTableOpeningDraw(
          createTableRoundState(
            openingDeck(playerCount),
            playerCount,
            KEEP_ORDER,
          ),
        );

        expect(state.phase).toBe("playing");
        expect(state.openingDraw.winnerSeat).toBe(0);
        expect(state.trick?.currentTurn).toBe(0);

        state = playTableCards(state, 0, cards);

        expect(state.trick?.leadingPlay?.seat).toBe(0);
        expect(state.trick?.leadingPlay?.hand.kind).toBe(kind);
        expect(state.trick?.currentTurn).toBe(1);

        for (let seat = 1; seat < playerCount; seat += 1) {
          state = passTableTurn(state, seat);
        }

        expect(state.phase).toBe("playing");
        expect(state.trick?.leadingPlay).toBeNull();
        expect(state.trick?.leaderSeat).toBe(0);
        expect(state.trick?.currentTurn).toBe(0);
        expect(state.trick?.completedTricks).toBe(1);
        expect(state.trick?.passedSeats).toEqual([]);
        expect(state.activeSeats).toEqual(
          Array.from({ length: playerCount }, (_, seat) => seat),
        );
        expect(state.finishingOrder).toEqual([]);
      }
    },
  );
});
