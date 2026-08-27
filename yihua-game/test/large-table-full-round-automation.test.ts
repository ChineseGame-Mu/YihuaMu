import { describe, expect, it } from "vitest";
import { createDeck, dealHands, type DeckCard } from "../src/core/deck.js";
import {
  passGameTurn,
  playGameCards,
  startNextRound,
  type PlayingState,
  type RoundCompleteState,
} from "../src/core/game-state.js";
import {
  canHandBeat,
  classifyHand,
  type ClassifiedHand,
} from "../src/core/hand.js";
import {
  createTableConfig,
  type SupportedPlayerCount,
} from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const counts: readonly SupportedPlayerCount[] = [6, 8, 10, 12, 14];

const createInitialState = (
  playerCount: SupportedPlayerCount,
): PlayingState => ({
  phase: "playing",
  config: createTableConfig(playerCount, 0),
  openingDraw: { attempts: [], winnerSeat: 0 },
  hands: dealHands(createDeck(playerCount), playerCount),
  currentTurn: 0,
  trick: createTrickState(playerCount, 0),
  finishedSeats: [],
});

describe.each(counts)("%i-player full-round automation", (playerCount) => {
  it("plays the whole table to complete placements without deadlock", () => {
    let state: PlayingState | RoundCompleteState =
      createInitialState(playerCount);
    let actions = 0;
    const maximumActions = playerCount * 27 * playerCount * 2;

    while (state.phase === "playing") {
      if (actions >= maximumActions) {
        throw new Error("automated round exceeded the action limit");
      }

      const seat: number = state.currentTurn;
      const hand: readonly DeckCard[] | undefined = state.hands[seat];
      if (hand === undefined || hand.length === 0) {
        throw new Error("current turn points to an empty or missing hand");
      }

      const leadingHand: ClassifiedHand | null =
        state.trick.leadingPlay?.hand ?? null;
      const playable: DeckCard | undefined =
        leadingHand === null
          ? hand[0]
          : hand.find((deckCard: DeckCard) =>
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
    expect(state.finishedSeats).toHaveLength(playerCount);
    expect(new Set(state.finishedSeats).size).toBe(playerCount);
    expect(state.placements).toHaveLength(playerCount);
    expect(state.winnerSeat).toBe(state.finishedSeats[0]);
    expect(state.outcome?.firstPlaceSeat).toBe(state.winnerSeat);
    expect(state.outcome?.lastPlaceSeat).toBe(
      state.finishedSeats[playerCount - 1],
    );

    const next = startNextRound(state, () => 0);
    expect(next.currentTurn).toBe(state.winnerSeat);
    expect(next.trick.leaderSeat).toBe(state.winnerSeat);
    expect(next.finishedSeats).toEqual([]);
    expect(next.hands).toHaveLength(playerCount);
    expect(next.hands.every((hand) => hand.length === 27)).toBe(true);
    expect(next.openingDraw).toBe(state.openingDraw);
  });
});
