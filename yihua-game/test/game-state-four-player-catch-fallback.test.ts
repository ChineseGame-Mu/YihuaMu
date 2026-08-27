import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  passGameTurn,
  playGameCards,
  type PlayingState,
} from "../src/core/game-state.js";
import { createTableConfig } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const card = (rank: "3" | "4" | "8"): Card => ({
  kind: "suited",
  rank,
  suit: "clubs",
});

const deckCard = (id: string, value: Card): DeckCard => ({
  id,
  copy: 0,
  card: value,
});

describe("four-player catch fallback", () => {
  it("skips a finished partner and gives the next lead to the nearest active opponent", () => {
    const eight = card("8");
    const state: PlayingState = {
      phase: "playing",
      config: createTableConfig(4, 0),
      openingDraw: { attempts: [], winnerSeat: 1 },
      hands: [
        [deckCard("seat-0", card("3"))],
        [deckCard("seat-1", eight)],
        [deckCard("seat-2", card("4"))],
        [],
      ],
      currentTurn: 1,
      trick: createTrickState(4, 1),
      finishedSeats: [3],
    };

    const afterFinish = playGameCards(state, 1, [eight]);
    expect(afterFinish.phase).toBe("playing");
    if (afterFinish.phase !== "playing") {
      throw new Error("round ended too early");
    }

    expect(afterFinish.finishedSeats).toEqual([3, 1]);
    expect(afterFinish.currentTurn).toBe(2);

    const afterSeat2Pass = passGameTurn(afterFinish, 2);
    expect(afterSeat2Pass.currentTurn).toBe(0);

    const afterSeat0Pass = passGameTurn(afterSeat2Pass, 0);
    expect(afterSeat0Pass.trick.leadingPlay).toBeNull();
    expect(afterSeat0Pass.currentTurn).toBe(2);
    expect(afterSeat0Pass.trick.leaderSeat).toBe(2);
    expect(afterSeat0Pass.finishedSeats).toEqual([3, 1]);
  });
});
