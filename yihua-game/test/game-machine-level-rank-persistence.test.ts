import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import { transitionGame } from "../src/core/game-machine.js";
import {
  createLobbyState,
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
  const base = startGame(createLobbyState(4, 0), seededRandom(919));
  const ace = deckCard("lead-ace", suited("A"));
  const five = deckCard("level-five", suited("5", "spades"));
  const filler = (seat: number): DeckCard =>
    deckCard(
      `filler-${seat}`,
      suited("3", seat % 2 === 0 ? "clubs" : "diamonds"),
    );

  return {
    ...base,
    hands: [[ace, filler(0)], [five, filler(1)], [filler(2)], [filler(3)]],
    currentTurn: 0,
    trick: createTrickState(4, 0),
    finishedSeats: [],
  };
};

describe("game machine level-rank persistence", () => {
  it("carries an explicit level rank through card-id play and later state", () => {
    const state = responseState();
    const aceLead = transitionGame(state, {
      type: "play-card-ids",
      seat: 0,
      cardIds: ["lead-ace"],
    });
    expect(aceLead.phase).toBe("playing");
    if (aceLead.phase !== "playing") throw new Error("playing phase expected");

    const levelBeat = transitionGame(aceLead, {
      type: "play-card-ids",
      seat: 1,
      cardIds: ["level-five"],
      levelRank: "5",
    });
    expect(levelBeat.phase).toBe("playing");
    if (levelBeat.phase !== "playing") throw new Error("playing phase expected");

    expect(levelBeat.levelRank).toBe("5");
    expect(levelBeat.trick.leadingPlay).toMatchObject({
      seat: 1,
      hand: { kind: "single", rank: "5" },
    });
  });
});
