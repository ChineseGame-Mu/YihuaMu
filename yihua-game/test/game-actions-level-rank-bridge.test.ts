import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import { playGameCardIds } from "../src/core/game-actions.js";
import {
  createLobbyState,
  playGameCards,
  startGame,
  type PlayingState,
} from "../src/core/game-state.js";
import { createTrickState } from "../src/core/trick-state.js";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const deckCard = (id: string, card: Card): DeckCard => ({ id, copy: 0, card });

const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const responseState = (): PlayingState => {
  const base = startGame(createLobbyState(4, 0), seededRandom(731));
  const ace = deckCard("lead-ace", suited("A"));
  const five = deckCard("response-five", suited("5", "spades"));
  const filler = (seat: number): DeckCard =>
    deckCard(`filler-${seat}`, suited("3", seat % 2 === 0 ? "clubs" : "diamonds"));
  const state: PlayingState = {
    ...base,
    hands: [
      [ace, filler(0)],
      [five, filler(1)],
      [filler(2)],
      [filler(3)],
    ],
    currentTurn: 0,
    trick: createTrickState(4, 0),
    finishedSeats: [],
  };

  return playGameCards(state, 0, [ace.card]) as PlayingState;
};

describe("card id action level-rank bridge", () => {
  it("passes an explicit level rank into table comparison", () => {
    const state = responseState();
    const next = playGameCardIds(state, 1, ["response-five"], "5");

    expect(next.trick.leadingPlay).toMatchObject({
      seat: 1,
      hand: { kind: "single", rank: "5" },
    });
    expect(next.hands[1]!.some(({ id }) => id === "response-five")).toBe(false);
  });

  it("keeps the first-round level rank as the default", () => {
    const state = responseState();

    expect(() => playGameCardIds(state, 1, ["response-five"])).toThrow();
  });
});
