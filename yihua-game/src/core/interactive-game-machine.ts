import type { Card, Rank } from "./cards.js";
import type { RandomSource } from "./deck.js";
import { playGameCardIds } from "./game-actions.js";
import {
  availableGameMachineActions,
  transitionGame,
  type GameMachineAction,
  type GameMachineActionType,
} from "./game-machine.js";
import type { GameState, PlayingState } from "./game-state.js";
import {
  advanceInteractiveOpeningDraw,
  beginInteractiveOpeningDraw,
  completeInteractiveOpeningDraw,
  dealAfterInteractiveOpeningDraw,
  startInteractiveFirstRound,
  type InteractiveOpeningState,
} from "./interactive-opening-state.js";

export type InteractiveGameState = GameState | InteractiveOpeningState;

export type InteractiveGameMachineAction =
  | { readonly type: "begin-interactive-opening" }
  | { readonly type: "start-interactive-first-round" }
  | { readonly type: "draw-opening-attempt" }
  | { readonly type: "complete-interactive-opening" }
  | { readonly type: "deal-after-interactive-opening" }
  | { readonly type: "complete-opening-and-deal" }
  | {
      readonly type: "play-card-ids";
      readonly seat: number;
      readonly cardIds: readonly string[];
      readonly levelRank?: Rank;
    }
  | GameMachineAction;

export type InteractiveGameMachineActionType =
  InteractiveGameMachineAction["type"];

const interactiveActionTypes = (
  state: InteractiveOpeningState,
): readonly InteractiveGameMachineActionType[] =>
  state.draw.phase === "complete"
    ? ["deal-after-interactive-opening", "complete-opening-and-deal"]
    : [
        "draw-opening-attempt",
        "complete-interactive-opening",
        "complete-opening-and-deal",
      ];

export const availableInteractiveGameActions = (
  state: InteractiveGameState,
): readonly InteractiveGameMachineActionType[] => {
  if (state.phase === "interactive-opening-draw") {
    return interactiveActionTypes(state);
  }
  if (state.phase === "lobby") {
    return [
      "begin-interactive-opening",
      "start-interactive-first-round",
      ...availableGameMachineActions(state),
    ];
  }
  if (state.phase === "playing") {
    return [...availableGameMachineActions(state), "play-card-ids"];
  }
  return availableGameMachineActions(state);
};

const phaseError = (
  state: InteractiveGameState,
  action: InteractiveGameMachineAction,
): never => {
  throw new Error(`cannot ${action.type} while game is ${state.phase}`);
};

const assertOpeningWinnerOwnsFirstLead = (
  state: PlayingState,
): PlayingState => {
  const winnerSeat = state.openingDraw.winnerSeat;
  if (
    state.currentTurn !== winnerSeat ||
    state.trick.leaderSeat !== winnerSeat
  ) {
    throw new Error("opening draw winner must own the first table lead");
  }
  return state;
};

const dealInteractiveOpening = (
  state: InteractiveOpeningState,
  random: RandomSource,
): PlayingState =>
  assertOpeningWinnerOwnsFirstLead(
    dealAfterInteractiveOpeningDraw(state, random),
  );

const asLegacyAction = (
  action: InteractiveGameMachineAction,
): GameMachineAction | null => {
  switch (action.type) {
    case "start-first-round":
    case "begin-opening-draw":
    case "deal-after-opening-draw":
    case "next-round":
      return action;
    case "play-cards":
      return {
        type: "play-cards",
        seat: action.seat,
        cards: action.cards as readonly Card[],
      };
    case "pass-turn":
      return action;
    case "begin-interactive-opening":
    case "start-interactive-first-round":
    case "draw-opening-attempt":
    case "complete-interactive-opening":
    case "deal-after-interactive-opening":
    case "complete-opening-and-deal":
    case "play-card-ids":
      return null;
  }
};

export const transitionInteractiveGame = (
  state: InteractiveGameState,
  action: InteractiveGameMachineAction,
  random: RandomSource = Math.random,
): InteractiveGameState => {
  switch (action.type) {
    case "begin-interactive-opening":
      return state.phase === "lobby"
        ? beginInteractiveOpeningDraw(state, random)
        : phaseError(state, action);
    case "start-interactive-first-round":
      return state.phase === "lobby"
        ? assertOpeningWinnerOwnsFirstLead(
            startInteractiveFirstRound(state, random),
          )
        : phaseError(state, action);
    case "draw-opening-attempt":
      return state.phase === "interactive-opening-draw"
        ? advanceInteractiveOpeningDraw(state)
        : phaseError(state, action);
    case "complete-interactive-opening":
      return state.phase === "interactive-opening-draw"
        ? completeInteractiveOpeningDraw(state)
        : phaseError(state, action);
    case "deal-after-interactive-opening":
      return state.phase === "interactive-opening-draw"
        ? dealInteractiveOpening(state, random)
        : phaseError(state, action);
    case "complete-opening-and-deal":
      if (state.phase !== "interactive-opening-draw") {
        return phaseError(state, action);
      }
      return dealInteractiveOpening(
        state.draw.phase === "complete"
          ? state
          : completeInteractiveOpeningDraw(state),
        random,
      );
    case "play-card-ids":
      return state.phase === "playing"
        ? playGameCardIds(state, action.seat, action.cardIds, action.levelRank)
        : phaseError(state, action);
    default: {
      if (state.phase === "interactive-opening-draw") {
        return phaseError(state, action);
      }
      const legacyAction = asLegacyAction(action);
      if (legacyAction === null) return phaseError(state, action);
      return transitionGame(state, legacyAction, random);
    }
  }
};
