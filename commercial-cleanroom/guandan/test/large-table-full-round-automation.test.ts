import { describe, expect, it } from "vitest";
import {
  createDeck,
  dealHands,
  shuffleDeck,
  type DeckCard,
  type RandomSource,
} from "../src/core/deck.js";
import {
  FIRST_ROUND_LEVEL_RANK,
  passGameTurn,
  playGameCards,
  startNextRound,
  type PlayingState,
  type RoundCompleteState,
} from "../src/core/game-state.js";
import {
  canHandBeatWithLevel,
  classifyHand,
  type ClassifiedHand,
} from "../src/core/hand.js";
import {
  createTableConfig,
  type SupportedPlayerCount,
} from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const counts: readonly SupportedPlayerCount[] = [6, 8, 10, 12, 14];

const seededRandom = (seed: number): RandomSource => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const createInitialState = (
  playerCount: SupportedPlayerCount,
  winnerSeat: number,
): PlayingState => ({
  phase: "playing",
  config: createTableConfig(playerCount, 0),
  openingDraw: { attempts: [], winnerSeat },
  hands: dealHands(
    shuffleDeck(
      createDeck(playerCount),
      seededRandom(playerCount * 1000 + winnerSeat + 1),
    ),
    playerCount,
  ),
  currentTurn: winnerSeat,
  trick: createTrickState(playerCount, winnerSeat),
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
            canHandBeatWithLevel(
              classifyHand([deckCard.card]),
              leadingHand,
              FIRST_ROUND_LEVEL_RANK,
            ),
          );

    state =
      playable === undefined
        ? passGameTurn(state, seat)
        : playGameCards(state, seat, [playable.card]);
    actions += 1;
  }

  return { completed: state, actions };
};

const expectCompleteRound = (
  completed: RoundCompleteState,
  playerCount: SupportedPlayerCount,
  openingWinner: number,
): void => {
  expect(completed.finishedSeats).toHaveLength(playerCount);
  expect(new Set(completed.finishedSeats).size).toBe(playerCount);
  expect(completed.placements).toHaveLength(playerCount);
  expect(completed.winnerSeat).toBe(completed.finishedSeats[0]);
  expect(completed.openingDraw.winnerSeat).toBe(openingWinner);
  expect(completed.outcome?.firstPlaceSeat).toBe(completed.winnerSeat);
  expect(completed.outcome?.lastPlaceSeat).toBe(
    completed.finishedSeats[playerCount - 1],
  );
};

describe.each(counts)("%i-player full-round automation", (playerCount) => {
  const openingWinners = Array.from({ length: playerCount }, (_, seat) => seat);

  it.each(openingWinners)(
    "plays three complete rounds from opening winner seat %i without deadlock or rerunning the opening draw",
    (openingWinner) => {
      const openingState = createInitialState(playerCount, openingWinner);
      const first = playToCompletion(openingState);
      expectCompleteRound(first.completed, playerCount, openingWinner);

      const secondStart = startNextRound(
        first.completed,
        seededRandom(playerCount * 2000 + openingWinner + 1),
      );
      expect(secondStart.currentTurn).toBe(first.completed.winnerSeat);
      expect(secondStart.trick.leaderSeat).toBe(first.completed.winnerSeat);
      expect(secondStart.finishedSeats).toEqual([]);
      expect(secondStart.hands).toHaveLength(playerCount);
      expect(secondStart.hands.every((hand) => hand.length === 27)).toBe(true);
      expect(secondStart.openingDraw).toBe(first.completed.openingDraw);

      const second = playToCompletion(secondStart);
      expectCompleteRound(second.completed, playerCount, openingWinner);
      expect(second.completed.openingDraw).toBe(first.completed.openingDraw);

      const thirdStart = startNextRound(
        second.completed,
        seededRandom(playerCount * 3000 + openingWinner + 1),
      );
      expect(thirdStart.currentTurn).toBe(second.completed.winnerSeat);
      expect(thirdStart.trick.leaderSeat).toBe(second.completed.winnerSeat);
      expect(thirdStart.finishedSeats).toEqual([]);
      expect(thirdStart.hands.every((hand) => hand.length === 27)).toBe(true);
      expect(thirdStart.openingDraw).toBe(first.completed.openingDraw);

      const third = playToCompletion(thirdStart);
      expectCompleteRound(third.completed, playerCount, openingWinner);
      expect(third.completed.openingDraw).toBe(first.completed.openingDraw);
    },
  );
});
