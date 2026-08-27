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

const card: Card = { kind: "suited", rank: "3", suit: "clubs" };
const deckCard: DeckCard = { id: "0:clubs:3", copy: 0, card };

const state: PlayingState = {
  phase: "playing",
  config: createTableConfig(4, 0),
  openingDraw: { attempts: [], winnerSeat: 0 },
  hands: [[], [deckCard], [deckCard], [deckCard]],
  currentTurn: 0,
  trick: createTrickState(4, 0),
  finishedSeats: [0],
};

describe("finished-seat guards", () => {
  it("rejects later play and pass actions from a seat that already finished", () => {
    expect(() => playGameCards(state, 0, [card])).toThrow(
      "finished seat cannot play",
    );
    expect(() => passGameTurn(state, 0)).toThrow(
      "finished seat cannot pass",
    );
  });
});
