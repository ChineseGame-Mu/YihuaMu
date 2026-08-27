import { describe, expect, it } from "vitest";
import { createDeck, dealHands } from "../src/core/deck.js";
import {
  passGameTurn,
  playGameCards,
  type PlayingState,
  type RoundCompleteState,
} from "../src/core/game-state.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";
import { createTableConfig } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const createInitialState = (): PlayingState => ({
  phase: "playing",
  config: createTableConfig(4, 0),
  openingDraw: { attempts: [], winnerSeat: 0 },
  hands: dealHands(createDeck(4), 4),
  currentTurn: 0,
  trick: createTrickState(4, 0),
  finishedSeats: [],
});

describe("four-seat full-round automation", () => {
  it("plays all four seats through a complete round without deadlock", () => {
    let state: PlayingState | RoundCompleteState = createInitialState();
    let actions = 0;
    const maximumActions = 2000;

    while (state.phase === "playing") {
      if (actions >= maximumActions) {
        throw new Error("automated round exceeded the action limit");
      }

      const seat = state.currentTurn;
      const hand = state.hands[seat];
      if (hand === undefined || hand.length === 0) {
        throw new Error("current turn points to an empty or missing hand");
      }

      const leadingHand = state.trick.leadingPlay?.hand ?? null;
      const playable =
        leadingHand === null
          ? hand[0]
          : hand.find((deckCard) =>
              canHandBeat(classifyHand([deckCard.card]), leadingHand),
            );

      state =
        playable === undefined
          ? passGameTurn(state, seat)
          : playGameCards(state, seat, [playable.card]);
      actions += 1;
    }

    expect(state.phase).toBe("round-complete");
    expect(actions).toBeLessThan(maximumActions);
    expect(state.finishedSeats).toHaveLength(4);
    expect(new Set(state.finishedSeats).size).toBe(4);
    expect(state.placements).toHaveLength(4);
    expect(state.winnerSeat).toBe(state.finishedSeats[0]);
    expect(state.outcome?.firstPlaceSeat).toBe(state.winnerSeat);
    expect(state.outcome?.lastPlaceSeat).toBe(state.finishedSeats[3]);
  });
});
