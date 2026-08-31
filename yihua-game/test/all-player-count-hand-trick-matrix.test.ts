import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import { classifyHand } from "../src/core/hand.js";
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
    card: suited(seat === playerCount - 1 ? "A" : "3"),
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

describe("complete hand and trick matrix across every supported table size", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "routes every supported hand kind through opening draw and table state for %i players",
    (playerCount) => {
      for (const [kind, cards] of legalHands) {
        expect(classifyHand(cards).kind).toBe(kind);

        const playing = completeTableOpeningDraw(
          createTableRoundState(
            openingDeck(playerCount),
            playerCount,
            KEEP_ORDER,
          ),
        );
        expect(playing.openingDraw.winnerSeat).toBe(playerCount - 1);
        expect(playing.trick?.currentTurn).toBe(playerCount - 1);

        const played = playTableCards(playing, playerCount - 1, cards);
        expect(played.trick?.leadingPlay?.seat).toBe(playerCount - 1);
        expect(played.trick?.leadingPlay?.hand.kind).toBe(kind);
        expect(played.trick?.currentTurn).toBe(0);
      }
    },
  );

  it.each(SUPPORTED_PLAYER_COUNTS)(
    "closes a trick through table state for %i players",
    (playerCount) => {
      let state = completeTableOpeningDraw(
        createTableRoundState(
          openingDeck(playerCount),
          playerCount,
          KEEP_ORDER,
        ),
      );
      state = playTableCards(state, playerCount - 1, [suited("7")]);

      expect(state.trick?.currentTurn).toBe(0);
      expect(state.trick?.leaderSeat).toBe(playerCount - 1);

      for (let seat = 0; seat < playerCount - 1; seat += 1) {
        state = passTableTurn(state, seat);
      }

      expect(state.trick?.leadingPlay).toBeNull();
      expect(state.trick?.currentTurn).toBe(playerCount - 1);
      expect(state.trick?.leaderSeat).toBe(playerCount - 1);
      expect(state.trick?.completedTricks).toBe(1);
      expect(state.trick?.passedSeats).toEqual([]);
    },
  );
});
