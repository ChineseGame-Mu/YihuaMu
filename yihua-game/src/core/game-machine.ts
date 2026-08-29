import type { Card } from "./cards.js";
import type { RandomSource } from "./deck.js";
import {
  dealAfterOpeningDraw,
  passGameTurn,
  playGameCards,
  startNextRound,
  startOpeningDraw,
  type GameState,
} from "./game-state.js";

export type GameMachineAction =
  | { readonly type: "start-first-round" }
  | { readonly type: "begin-opening-draw" }
  | { readonly type: "deal-after-opening-draw" }
  | {
      readonly type: "play-cards";
      readonly seat: number;
      readonly cards: readonly Card[];
    }
  | { readonly type: "pass-turn"; readonly seat: number }
  | { readonly type: "next-round" };

const phaseError = (state: GameState, action: GameMachineAction): never => {
  throw new Error(`cannot ${action.type} while game is ${state.phase}`);
};

export const transitionGame = (
  state: GameState,
  action: GameMachineAction,
  random: RandomSource = Math.random,
): GameState => {
  switch (action.type) {
    case "start-first-round":
      return state.phase === "lobby"
        ? dealAfterOpeningDraw(startOpeningDraw(state, random), random)
        : phaseError(state, action);
    case "begin-opening-draw":
      return state.phase === "lobby"
        ? startOpeningDraw(state, random)
        : phaseError(state, action);
    case "deal-after-opening-draw":
      return state.phase === "opening-draw"
        ? dealAfterOpeningDraw(state, random)
        : phaseError(state, action);
    case "play-cards":
      return state.phase === "playing"
        ? playGameCards(state, action.seat, action.cards)
        : phaseError(state, action);
    case "pass-turn":
      return state.phase === "playing"
        ? passGameTurn(state, action.seat)
        : phaseError(state, action);
    case "next-round":
      return state.phase === "round-complete"
        ? startNextRound(state, random)
        : phaseError(state, action);
  }
};
