import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import type { PlayingState } from "../src/core/game-state.js";
import {
  createTurnState,
  passTurn,
  playCards,
} from "../src/core/play-state.js";
import { createTableConfig } from "../src/core/table.js";

const suitedCard = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});

let serial = 0;
const deckCard = (card: Card): DeckCard => ({
  id: `test-${serial++}`,
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
});

describe("play-state", () => {
  it("removes played cards, advances turn and exposes the public play", () => {
    const pair = [
      deckCard(suitedCard("9", "clubs")),
      deckCard(suitedCard("9", "spades")),
    ];
    const state = createTurnState(playingState([pair, [], [], []]), "7");

    const next = playCards(
      state,
      0,
      pair.map(({ id }) => id),
    );

    expect(next.hands[0]).toHaveLength(0);
    expect(next.currentTurn).toBe(1);
    expect(next.currentPlay?.hand).toEqual({
      kind: "pair",
      size: 2,
      rank: "9",
    });
    expect(next.publicActions).toHaveLength(1);
  });

  it("rejects out-of-turn, missing-card and non-beating plays", () => {
    const nines = [
      deckCard(suitedCard("9", "clubs")),
      deckCard(suitedCard("9", "spades")),
    ];
    const eights = [
      deckCard(suitedCard("8", "clubs")),
      deckCard(suitedCard("8", "spades")),
    ];
    let state = createTurnState(playingState([nines, eights, [], []]), "7");

    expect(() =>
      playCards(
        state,
        1,
        eights.map(({ id }) => id),
      ),
    ).toThrow();
    expect(() => playCards(state, 0, ["not-in-hand"])).toThrow();

    state = playCards(
      state,
      0,
      nines.map(({ id }) => id),
    );
    expect(() =>
      playCards(
        state,
        1,
        eights.map(({ id }) => id),
      ),
    ).toThrow("does not beat");
  });

  it("uses a heart level wildcard when validating a response", () => {
    const kings = [
      deckCard(suitedCard("K", "clubs")),
      deckCard(suitedCard("K", "spades")),
    ];
    const aceAndWildcard = [
      deckCard(suitedCard("A", "clubs")),
      deckCard(suitedCard("7", "hearts")),
    ];
    let state = createTurnState(
      playingState([kings, aceAndWildcard, [], []]),
      "7",
    );

    state = playCards(
      state,
      0,
      kings.map(({ id }) => id),
    );
    state = playCards(
      state,
      1,
      aceAndWildcard.map(({ id }) => id),
      "pair",
    );

    expect(state.currentPlay?.hand).toEqual({
      kind: "pair",
      size: 2,
      rank: "A",
    });
    expect(state.currentTurn).toBe(2);
  });

  it("rejects passing on a lead and resets the trick after everyone else passes", () => {
    const ace = [deckCard(suitedCard("A", "clubs"))];
    let state = createTurnState(playingState([ace, [], [], []]), "7");

    expect(() => passTurn(state, 0)).toThrow("cannot pass");
    state = playCards(state, 0, [ace[0]!.id]);
    state = passTurn(state, 1);
    state = passTurn(state, 2);
    state = passTurn(state, 3);

    expect(state.currentPlay).toBeNull();
    expect(state.currentTurn).toBe(0);
    expect(state.consecutivePasses).toBe(0);
    expect(state.publicActions).toHaveLength(4);
  });
});
