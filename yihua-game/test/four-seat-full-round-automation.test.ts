import { describe, expect, it } from "vitest";
import { createDeck, dealHands, type DeckCard } from "../src/core/deck.js";
import { transitionGame } from "../src/core/game-machine.js";
import type { GameState, PlayingState } from "../src/core/game-state.js";
import {
  canHandBeat,
  classifyHand,
  type ClassifiedHand,
} from "../src/core/hand.js";
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
  it("plays all four seats through the table machine without deadlock", () => {
    let state: GameState = createInitialState();
    let actions = 0;
    const maximumActions = 2000;

    while (state.phase === "playing") {
      if (actions >= maximumActions) {
        throw new Error("automated round exceeded the action limit");
      }

      const playingState: PlayingState = state;
      const seat: number = playingState.currentTurn;
      const hand: readonly DeckCard[] | undefined = playingState.hands[seat];
      if (hand === undefined || hand.length === 0) {
        throw new Error("current turn points to an empty or missing hand");
      }

      const leadingHand: ClassifiedHand | null =
        playingState.trick.leadingPlay?.hand ?? null;
      const playable: DeckCard | undefined =
        leadingHand === null
          ? hand[0]
          : hand.find((deckCard: DeckCard) =>
              canHandBeat(classifyHand([deckCard.card]), leadingHand),
            );

      state =
        playable === undefined
          ? transitionGame(playingState, { type: "pass-turn", seat })
          : transitionGame(playingState, {
              type: "play-cards",
              seat,
              cards: [playable.card],
            });
      actions += 1;
    }

    expect(state.phase).toBe("round-complete");
    if (state.phase !== "round-complete") {
      throw new Error("round-complete phase expected");
    }
    expect(actions).toBeLessThan(maximumActions);
    expect(state.finishedSeats).toHaveLength(4);
    expect(new Set(state.finishedSeats).size).toBe(4);
    expect(state.placements).toHaveLength(4);
    expect(state.winnerSeat).toBe(state.finishedSeats[0]);
    expect(state.outcome?.firstPlaceSeat).toBe(state.winnerSeat);
    expect(state.outcome?.lastPlaceSeat).toBe(state.finishedSeats[3]);

    const completedWinner = state.winnerSeat;
    const next = transitionGame(state, { type: "next-round" }, () => 0);
    expect(next.phase).toBe("playing");
    if (next.phase !== "playing") {
      throw new Error("playing phase expected");
    }
    expect(next.currentTurn).toBe(completedWinner);
    expect(next.trick.leaderSeat).toBe(completedWinner);
    expect(next.finishedSeats).toEqual([]);
    expect(next.hands).toHaveLength(4);
    expect(next.hands.every((hand) => hand.length === 27)).toBe(true);
  });
});
