import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import { playGameCards, type PlayingState } from "../src/core/game-state.js";
import { createTableConfig } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const lastCard: Card = { kind: "suited", rank: "3", suit: "clubs" };
const spareCard: Card = { kind: "suited", rank: "4", suit: "clubs" };

const deckCard = (id: string, card: Card): DeckCard => ({ id, copy: 0, card });

describe("no-opponent immediate catch", () => {
  it("clears the trick and gives the nearest active teammate the lead", () => {
    const state: PlayingState = {
      phase: "playing",
      config: createTableConfig(6, 0),
      openingDraw: { attempts: [], winnerSeat: 0 },
      hands: [
        [deckCard("s0", lastCard)],
        [],
        [deckCard("s2", spareCard)],
        [],
        [deckCard("s4", spareCard)],
        [],
      ],
      currentTurn: 0,
      trick: createTrickState(6, 0),
      finishedSeats: [1, 3, 5],
    };

    const next = playGameCards(state, 0, [lastCard]);
    expect(next.phase).toBe("playing");
    if (next.phase !== "playing") throw new Error("expected playing");

    expect(next.finishedSeats).toEqual([1, 3, 5, 0]);
    expect(next.currentTurn).toBe(2);
    expect(next.trick.leaderSeat).toBe(2);
    expect(next.trick.currentTurn).toBe(2);
    expect(next.trick.leadingPlay).toBeNull();
    expect(next.trick.passedSeats).toEqual([]);
    expect(next.trick.completedTricks).toBe(1);
  });
});
