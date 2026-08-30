import { createDeck, type RandomSource } from "./deck.js";
import {
  dealAfterOpeningDraw,
  type LobbyState,
  type OpeningDrawState,
  type PlayingState,
} from "./game-state.js";
import {
  advanceOpeningDrawMachine,
  completeOpeningDrawMachine,
  createOpeningDrawMachine,
  openingDrawMachineProgress,
  openingDrawMachinePrompt,
  openingDrawMachineResult,
  type OpeningDrawMachineProgress,
  type OpeningDrawMachinePrompt,
  type OpeningDrawMachineState,
} from "./opening-draw-machine.js";

export interface InteractiveOpeningState {
  readonly phase: "interactive-opening-draw";
  readonly lobby: LobbyState;
  readonly draw: OpeningDrawMachineState;
}

export interface InteractiveOpeningSnapshot {
  readonly phase: "interactive-opening-draw";
  readonly playerCount: LobbyState["config"]["playerCount"];
  readonly progress: OpeningDrawMachineProgress;
  readonly prompt: OpeningDrawMachinePrompt;
  readonly readyToDeal: boolean;
}

export const beginInteractiveOpeningDraw = (
  lobby: LobbyState,
  random: RandomSource = Math.random,
): InteractiveOpeningState => ({
  phase: "interactive-opening-draw",
  lobby,
  draw: createOpeningDrawMachine(
    createDeck(lobby.config.playerCount),
    lobby.config.playerCount,
    random,
  ),
});

export const interactiveOpeningSnapshot = (
  state: InteractiveOpeningState,
): InteractiveOpeningSnapshot => ({
  phase: state.phase,
  playerCount: state.lobby.config.playerCount,
  progress: openingDrawMachineProgress(state.draw),
  prompt: openingDrawMachinePrompt(state.draw),
  readyToDeal: openingDrawMachineResult(state.draw) !== null,
});

export const advanceInteractiveOpeningDraw = (
  state: InteractiveOpeningState,
): InteractiveOpeningState => ({
  ...state,
  draw: advanceOpeningDrawMachine(state.draw),
});

export const completeInteractiveOpeningDraw = (
  state: InteractiveOpeningState,
): InteractiveOpeningState => ({
  ...state,
  draw: completeOpeningDrawMachine(state.draw),
});

export const finishInteractiveOpeningDraw = (
  state: InteractiveOpeningState,
): OpeningDrawState => {
  const openingDraw = openingDrawMachineResult(state.draw);
  if (openingDraw === null) {
    throw new Error("opening draw has not produced a unique winner");
  }

  return {
    phase: "opening-draw",
    config: state.lobby.config,
    openingDraw,
  };
};

export const dealAfterInteractiveOpeningDraw = (
  state: InteractiveOpeningState,
  random: RandomSource = Math.random,
): PlayingState =>
  dealAfterOpeningDraw(finishInteractiveOpeningDraw(state), random);

export const startInteractiveFirstRound = (
  lobby: LobbyState,
  random: RandomSource = Math.random,
): PlayingState =>
  dealAfterInteractiveOpeningDraw(
    completeInteractiveOpeningDraw(beginInteractiveOpeningDraw(lobby, random)),
    random,
  );
