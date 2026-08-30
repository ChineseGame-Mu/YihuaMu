import { availableInteractiveGameActions, type InteractiveGameState } from "./interactive-game-machine.js";
import { openingDrawMachineProgress, type OpeningDrawMachineProgress } from "./opening-draw-machine.js";

export interface InteractiveGameSnapshot {
  readonly phase: InteractiveGameState["phase"];
  readonly availableActions: readonly string[];
  readonly playerCount: number;
  readonly openingDraw: OpeningDrawMachineProgress | null;
  readonly currentTurn: number | null;
  readonly finishedSeats: readonly number[];
}

export const interactiveGameSnapshot = (
  state: InteractiveGameState,
): InteractiveGameSnapshot => {
  if (state.phase === "interactive-opening-draw") {
    return {
      phase: state.phase,
      availableActions: availableInteractiveGameActions(state),
      playerCount: state.lobby.config.playerCount,
      openingDraw: openingDrawMachineProgress(state.draw),
      currentTurn: null,
      finishedSeats: [],
    };
  }

  return {
    phase: state.phase,
    availableActions: availableInteractiveGameActions(state),
    playerCount: state.config.playerCount,
    openingDraw: null,
    currentTurn:
      state.phase === "playing" || state.phase === "round-complete"
        ? state.currentTurn
        : null,
    finishedSeats:
      state.phase === "playing" || state.phase === "round-complete"
        ? (state.finishedSeats ?? [])
        : [],
  };
};
