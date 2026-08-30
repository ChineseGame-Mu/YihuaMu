import type { Card } from "./cards.js";
import {
  availableInteractiveGameActions,
  type InteractiveGameState,
} from "./interactive-game-machine.js";
import {
  openingDrawMachineProgress,
  type OpeningDrawMachineProgress,
} from "./opening-draw-machine.js";

export interface InteractiveGameSnapshot {
  readonly phase: InteractiveGameState["phase"];
  readonly availableActions: readonly string[];
  readonly playerCount: number;
  readonly openingDraw: OpeningDrawMachineProgress | null;
  readonly currentTurn: number | null;
  readonly handCounts: readonly number[];
  readonly leadingPlay: { readonly seat: number; readonly cards: readonly Card[] } | null;
  readonly passedSeats: readonly number[];
  readonly completedTricks: number;
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
      handCounts: [],
      leadingPlay: null,
      passedSeats: [],
      completedTricks: 0,
      finishedSeats: [],
    };
  }

  const tableActive = state.phase === "playing" || state.phase === "round-complete";

  return {
    phase: state.phase,
    availableActions: availableInteractiveGameActions(state),
    playerCount: state.config.playerCount,
    openingDraw: null,
    currentTurn: tableActive ? state.currentTurn : null,
    handCounts: tableActive ? state.hands.map((hand) => hand.length) : [],
    leadingPlay: tableActive
      ? state.trick.leadingPlay === null
        ? null
        : {
            seat: state.trick.leadingPlay.seat,
            cards: state.trick.leadingPlay.cards,
          }
      : null,
    passedSeats: tableActive ? state.trick.passedSeats : [],
    completedTricks: tableActive ? state.trick.completedTricks : 0,
    finishedSeats: tableActive ? (state.finishedSeats ?? []) : [],
  };
};
