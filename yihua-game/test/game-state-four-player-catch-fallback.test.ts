import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import { playGameCards, type PlayingState } from "../src/core/game-state.js";
import { createTableConfig } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const card = (rank: "3" | "4" | "5" | "8"): Card => ({
  kind: "suited",
  rank,
  suit: "clubs",
});

const deckCard = (id: string, value: Card): DeckCard => ({
  id,
  copy: 0,
  card: value,
});

describe("four-player double-down completion", () => {
  it("ends immediately when partners take first and second", () => {
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
    expect(afterFinish.phase).toBe("round-complete");
    if (afterFinish.phase !== "round-complete") {
      throw new Error("expected double-down round completion");
    }

    expect(afterFinish.finishedSeats).toEqual([3, 1, 0, 2]);
    expect(afterFinish.outcome?.winningTeam).toBe("B");
    expect(afterFinish.lastPromotionSteps).toBe(3);
  });

  it("ranks the remaining opponents by their cards left", () => {
    const eight = card("8");
    const four = card("4");
    const five = card("5");
    const state: PlayingState = {
      phase: "playing",
      config: createTableConfig(4, 0),
      openingDraw: { attempts: [], winnerSeat: 1 },
      hands: [
        [
          deckCard("seat-0-three", card("3")),
          deckCard("seat-0-four", four),
        ],
        [deckCard("seat-1", eight)],
        [deckCard("seat-2-five", five)],
        [],
      ],
      currentTurn: 1,
      trick: createTrickState(4, 1),
      finishedSeats: [3],
    };

    const afterFinish = playGameCards(state, 1, [eight]);
    expect(afterFinish.phase).toBe("round-complete");
    if (afterFinish.phase !== "round-complete") {
      throw new Error("expected double-down round completion");
    }
    expect(afterFinish.finishedSeats).toEqual([3, 1, 2, 0]);
  });
});
