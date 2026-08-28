import { describe, expect, it } from "vitest";
import { type Card } from "../src/core/cards.js";
import { type DeckCard } from "../src/core/deck.js";
import { transitionGame } from "../src/core/game-machine.js";
import { type PlayingState } from "../src/core/game-state.js";
import { classifyHand, type HandKind } from "../src/core/hand.js";
import { createTableConfig } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const suited = (
  rank: Extract<Card, { kind: "suited" }>["rank"],
  suit: Extract<Card, { kind: "suited" }>["suit"],
): Card => ({ kind: "suited", rank, suit });

const joker = (size: Extract<Card, { kind: "joker" }>["size"]): Card => ({
  kind: "joker",
  size,
});

const cases: readonly { kind: HandKind; cards: readonly Card[] }[] = [
  { kind: "pair", cards: [suited("3", "clubs"), suited("3", "diamonds")] },
  {
    kind: "triple",
    cards: [
      suited("4", "clubs"),
      suited("4", "diamonds"),
      suited("4", "hearts"),
    ],
  },
  {
    kind: "full-house",
    cards: [
      suited("5", "clubs"),
      suited("5", "diamonds"),
      suited("5", "hearts"),
      suited("6", "clubs"),
      suited("6", "diamonds"),
    ],
  },
  {
    kind: "straight",
    cards: [
      suited("3", "clubs"),
      suited("4", "diamonds"),
      suited("5", "hearts"),
      suited("6", "spades"),
      suited("7", "clubs"),
    ],
  },
  {
    kind: "straight-flush",
    cards: [
      suited("4", "hearts"),
      suited("5", "hearts"),
      suited("6", "hearts"),
      suited("7", "hearts"),
      suited("8", "hearts"),
    ],
  },
  {
    kind: "consecutive-pairs",
    cards: [
      suited("6", "clubs"),
      suited("6", "diamonds"),
      suited("7", "clubs"),
      suited("7", "diamonds"),
      suited("8", "clubs"),
      suited("8", "diamonds"),
    ],
  },
  {
    kind: "consecutive-triples",
    cards: [
      suited("9", "clubs"),
      suited("9", "diamonds"),
      suited("9", "hearts"),
      suited("10", "clubs"),
      suited("10", "diamonds"),
      suited("10", "hearts"),
    ],
  },
  {
    kind: "bomb",
    cards: [
      suited("J", "clubs"),
      suited("J", "diamonds"),
      suited("J", "hearts"),
      suited("J", "spades"),
    ],
  },
  {
    kind: "bomb",
    cards: [
      suited("Q", "clubs"),
      suited("Q", "diamonds"),
      suited("Q", "hearts"),
      suited("Q", "spades"),
      suited("Q", "clubs"),
      suited("Q", "diamonds"),
    ],
  },
  {
    kind: "joker-bomb",
    cards: [joker("small"), joker("small"), joker("big"), joker("big")],
  },
];

const asDeckCards = (
  cards: readonly Card[],
  prefix: string,
): readonly DeckCard[] =>
  cards.map((card, index) => ({
    id: `${prefix}-${index}`,
    copy: index % 2,
    card,
  }));

describe("combination-hand automation", () => {
  it.each(cases)(
    "plays $kind through the explicit table state machine",
    ({ kind, cards }) => {
      expect(classifyHand(cards).kind).toBe(kind);
      const filler = suited("2", "spades");
      const state: PlayingState = {
        phase: "playing",
        config: createTableConfig(4, 0),
        openingDraw: { attempts: [], winnerSeat: 0 },
        hands: [
          asDeckCards([...cards, filler], "seat-0"),
          asDeckCards([filler], "seat-1"),
          asDeckCards([filler], "seat-2"),
          asDeckCards([filler], "seat-3"),
        ],
        currentTurn: 0,
        trick: createTrickState(4, 0),
        finishedSeats: [],
      };

      const next = transitionGame(state, {
        type: "play-cards",
        seat: 0,
        cards,
      });
      expect(next.phase).toBe("playing");
      if (next.phase !== "playing")
        throw new Error("combination play unexpectedly completed the round");
      expect(next.trick.leadingPlay?.seat).toBe(0);
      expect(next.trick.leadingPlay?.hand.kind).toBe(kind);
      expect(next.hands[0]).toHaveLength(1);
    },
  );
});
