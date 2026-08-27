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

const playToCompletion = (
  initial: PlayingState,
): { completed: RoundCompleteState; actions: number } => {
  let state: PlayingState | RoundCompleteState = initial;
  let actions = 0;
  const maximumActions =
    initial.config.playerCount * 27 * initial.config.playerCount * 2;

  while (state.phase === "playing") {
    if (actions >= maximumActions) {
      throw new Error("automated round exceeded the action limit");
    }

    const seat: number = state.currentTurn;
    const hand: readonly DeckCard[] | undefined = state.hands[seat];
    if (hand === undefined || hand.length === 0) {
      throw new Error("current turn points to an empty or missing hand");
    }
    if (state.finishedSeats?.includes(seat)) {
      throw new Error("current turn points to a finished seat");
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

  return { completed: state, actions };
};

describe.each(counts)("%i-player full-round automation", (playerCount) => {
  it("plays two complete rounds without deadlock or rerunning the opening draw", () => {
    const openingState = createInitialState(playerCount);
    const first = playToCompletion(openingState);

    expect(first.completed.finishedSeats).toHaveLength(playerCount);
    expect(new Set(first.completed.finishedSeats).size).toBe(playerCount);
    expect(first.completed.placements).toHaveLength(playerCount);
    expect(first.completed.winnerSeat).toBe(first.completed.finishedSeats[0]);
    expect(first.completed.outcome?.firstPlaceSeat).toBe(
      first.completed.winnerSeat,
    );
    expect(first.completed.outcome?.lastPlaceSeat).toBe(
      first.completed.finishedSeats[playerCount - 1],
    );

    const secondStart = startNextRound(first.completed, () => 0);
    expect(secondStart.currentTurn).toBe(first.completed.winnerSeat);
    expect(secondStart.trick.leaderSeat).toBe(first.completed.winnerSeat);
    expect(secondStart.finishedSeats).toEqual([]);
    expect(secondStart.hands).toHaveLength(playerCount);
    expect(secondStart.hands.every((hand) => hand.length === 27)).toBe(true);
    expect(secondStart.openingDraw).toBe(first.completed.openingDraw);

    const second = playToCompletion(secondStart);
    expect(second.completed.finishedSeats).toHaveLength(playerCount);
    expect(new Set(second.completed.finishedSeats).size).toBe(playerCount);
    expect(second.completed.placements).toHaveLength(playerCount);
    expect(second.completed.winnerSeat).toBe(second.completed.finishedSeats[0]);
    expect(second.completed.openingDraw).toBe(first.completed.openingDraw);
    expect(second.completed.outcome?.firstPlaceSeat).toBe(
      second.completed.winnerSeat,
    );
  });
});
