import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  FIRST_ROUND_LEVEL_RANK,
  playGameCards,
  type PlayingState,
} from "../src/core/game-state.js";
import { createTableConfig } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const deckCard = (id: string, card: Card): DeckCard => ({
  id,
  copy: 0,
  card,
});

const playingState = (
  hands: readonly (readonly DeckCard[])[],
): PlayingState => ({
  phase: "playing",
  config: createTableConfig(4, 0),
  openingDraw: { attempts: [], winnerSeat: 0 },
  hands,
  currentTurn: 0,
  trick: createTrickState(4, 0),
  finishedSeats: [],
});

describe("first-round level wildcard game-state integration", () => {
  it("uses heart 2 as the first-round wildcard in the real play state machine", () => {
    const cards = [
      suited("7"),
      suited("8", "diamonds"),
      suited("9", "spades"),
      suited("J", "diamonds"),
      suited("2", "hearts"),
    ];
    const spare = suited("K", "clubs");
    const state = playingState([
      [
        ...cards.map((card, index) => deckCard(`lead-${index}`, card)),
        deckCard("spare", spare),
      ],
      [deckCard("seat-1", suited("3"))],
      [deckCard("seat-2", suited("4"))],
      [deckCard("seat-3", suited("5"))],
    ]);

    const next = playGameCards(state, 0, cards);

    expect(FIRST_ROUND_LEVEL_RANK).toBe("2");
    expect(next.phase).toBe("playing");
    expect(next.trick.leadingPlay?.hand).toEqual({
      kind: "straight",
      size: 5,
      highRank: "J",
    });
    expect(next.hands[0]).toEqual([deckCard("spare", spare)]);
    expect(next.currentTurn).toBe(1);
  });

  it("allows an explicit future level rank without changing table rotation", () => {
    const cards = [
      suited("Q"),
      suited("Q", "diamonds"),
      suited("Q", "spades"),
      suited("6", "hearts"),
    ];
    const state = playingState([
      [
        ...cards.map((card, index) => deckCard(`bomb-${index}`, card)),
        deckCard("spare", suited("A")),
      ],
      [deckCard("seat-1", suited("3"))],
      [deckCard("seat-2", suited("4"))],
      [deckCard("seat-3", suited("5"))],
    ]);

    const next = playGameCards(state, 0, cards, "6");

    expect(next.trick.leadingPlay?.hand).toEqual({
      kind: "bomb",
      size: 4,
      rank: "Q",
    });
    expect(next.currentTurn).toBe(1);
  });
});
