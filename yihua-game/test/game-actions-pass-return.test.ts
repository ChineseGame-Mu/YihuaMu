import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import { passGameSeat } from "../src/core/game-actions.js";
import type { PlayingState } from "../src/core/game-state.js";
import { createTableConfig } from "../src/core/table.js";
import { createTrickState, playCards } from "../src/core/trick-state.js";

const three: Card = { kind: "suited", rank: "3", suit: "clubs" };
const four: Card = { kind: "suited", rank: "4", suit: "clubs" };

const deckCard = (id: string, card: Card): DeckCard => ({ id, copy: 0, card });

const makeState = (): PlayingState => {
  const trick = playCards(createTrickState(4, 0), 0, [three]);
  return {
    phase: "playing",
    config: createTableConfig(4, 0),
    openingDraw: { attempts: [], winnerSeat: 0 },
    hands: [
      [deckCard("seat-0", three)],
      [deckCard("seat-1", four)],
      [deckCard("seat-2", four)],
      [deckCard("seat-3", four)],
    ],
    currentTurn: trick.currentTurn,
    trick,
    levelRank: "2",
    finishedSeats: [],
  };
};

describe("card-id pass action", () => {
  it("returns the updated playing state so callers can continue the table machine", () => {
    const state = makeState();
    expect(state.currentTurn).toBe(1);

    const next = passGameSeat(state, 1);

    expect(next.phase).toBe("playing");
    expect(next.currentTurn).toBe(2);
    expect(next.trick.passedSeats).toEqual([1]);
    expect(next.trick.leadingPlay?.seat).toBe(0);
  });
});
