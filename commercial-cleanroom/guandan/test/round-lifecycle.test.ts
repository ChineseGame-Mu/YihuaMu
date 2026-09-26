import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  playGameCards,
  startNextRound,
  type PlayingState,
} from "../src/core/game-state.js";
import { CARDS_PER_PLAYER, createTableConfig } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const card = (rank: "6" | "7"): Card => ({
  kind: "suited",
  rank,
  suit: "clubs",
});

const deckCard = (id: string, value: Card): DeckCard => ({
  id,
  copy: 0,
  card: value,
});

describe("round lifecycle", () => {
  it("starts the next round from first place without another opening draw", () => {
    const openingDraw = { attempts: [], winnerSeat: 3 };
    const six = card("6");
    const state: PlayingState = {
      phase: "playing",
      config: createTableConfig(4, 0),
      openingDraw,
      hands: [
        [],
        [],
        [deckCard("0:clubs:6", six)],
        [deckCard("0:clubs:7", card("7"))],
      ],
      currentTurn: 2,
      trick: createTrickState(4, 2),
      finishedSeats: [1, 0],
    };

    const completed = playGameCards(state, 2, [six]);
    expect(completed.phase).toBe("round-complete");
    if (completed.phase !== "round-complete") {
      throw new Error("expected round completion");
    }

    expect(completed.outcome).toEqual({
      winningTeam: "B",
      losingTeam: "A",
      firstPlaceSeat: 1,
      lastPlaceSeat: 3,
    });

    const next = startNextRound(completed, () => 0.24);
    expect(next.openingDraw).toBe(openingDraw);
    expect(next.currentTurn).toBe(1);
    expect(next.trick.leaderSeat).toBe(1);
    expect(next.trick.currentTurn).toBe(1);
    expect(next.finishedSeats).toEqual([]);
    expect(next.hands.every((hand) => hand.length === CARDS_PER_PLAYER)).toBe(
      true,
    );
  });
});
