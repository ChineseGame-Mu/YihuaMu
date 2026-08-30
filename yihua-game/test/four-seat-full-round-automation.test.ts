import { describe, expect, it } from "vitest";
import { createDeck, dealHands, type DeckCard } from "../src/core/deck.js";
import { transitionGame } from "../src/core/game-machine.js";
import {
  FIRST_ROUND_LEVEL_RANK,
  type GameState,
  type PlayingState,
} from "../src/core/game-state.js";
import {
  canHandBeatWithLevel,
  classifyHand,
  type ClassifiedHand,
} from "../src/core/hand.js";
import { createTableConfig } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const PLAYER_COUNTS = [4, 6, 8, 10, 12, 14] as const;
type SupportedPlayerCount = (typeof PLAYER_COUNTS)[number];
const ROUND_COUNT = 3;

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

const driveRound = (
  initialState: PlayingState,
): { state: GameState; actions: number } => {
  let state: GameState = initialState;
  let actions = 0;
  const maximumActions = 10000;

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
            canHandBeatWithLevel(
              classifyHand([deckCard.card]),
              leadingHand,
              FIRST_ROUND_LEVEL_RANK,
            ),
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

  return { state, actions };
};

describe("full-round table automation", () => {
  for (const playerCount of PLAYER_COUNTS) {
    it(`plays ${playerCount} seats through ${ROUND_COUNT} rounds without deadlock`, () => {
      let state: GameState = createInitialState(playerCount);
      const openingDrawSnapshot = JSON.stringify(state.openingDraw);

      for (let round = 0; round < ROUND_COUNT; round += 1) {
        if (state.phase !== "playing") {
          throw new Error("playing phase expected before automated round");
        }

        const { state: completedState, actions } = driveRound(state);
        state = completedState;

        expect(state.phase).toBe("round-complete");
        if (state.phase !== "round-complete") {
          throw new Error("round-complete phase expected");
        }
        expect(actions).toBeLessThan(10000);
        expect(state.finishedSeats).toHaveLength(playerCount);
        expect(new Set(state.finishedSeats).size).toBe(playerCount);
        expect(state.placements).toHaveLength(playerCount);
        expect(state.winnerSeat).toBe(state.finishedSeats[0]);
        expect(state.outcome?.firstPlaceSeat).toBe(state.winnerSeat);
        expect(state.outcome?.lastPlaceSeat).toBe(
          state.finishedSeats[playerCount - 1],
        );
        expect(JSON.stringify(state.openingDraw)).toBe(openingDrawSnapshot);

        if (round === ROUND_COUNT - 1) {
          continue;
        }

        const completedWinner = state.winnerSeat;
        state = transitionGame(state, { type: "next-round" }, () => 0);
        expect(state.phase).toBe("playing");
        if (state.phase !== "playing") {
          throw new Error("playing phase expected");
        }
        expect(state.currentTurn).toBe(completedWinner);
        expect(state.trick.leaderSeat).toBe(completedWinner);
        expect(state.finishedSeats).toEqual([]);
        expect(state.hands).toHaveLength(playerCount);
        expect(state.hands.every((hand) => hand.length === 27)).toBe(true);
        expect(JSON.stringify(state.openingDraw)).toBe(openingDrawSnapshot);
      }
    });
  }
});
