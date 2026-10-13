import type { Card } from "./cards.js";
import { classifyHand, type ClassifiedHand } from "./hand.js";
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
  readonly openingWinnerSeat: number | null;
  readonly leaderSeat: number | null;
  readonly currentTurn: number | null;
  readonly handCounts: readonly number[];
  readonly leadingPlay: {
    readonly seat: number;
    readonly cards: readonly Card[];
  } | null;
  readonly leadingHand: ClassifiedHand | null;
  readonly passedSeats: readonly number[];
  readonly completedTricks: number;
  readonly finishedSeats: readonly number[];
}

export const interactiveGameSnapshot = (
  state: InteractiveGameState,
): InteractiveGameSnapshot => {
  if (state.phase === "interactive-opening-draw") {
    const openingDraw = openingDrawMachineProgress(state.draw);
    return {
      phase: state.phase,
      availableActions: availableInteractiveGameActions(state),
      playerCount: state.lobby.config.playerCount,
      openingDraw,
      openingWinnerSeat: openingDraw.winnerSeat,
      leaderSeat: null,
      currentTurn: null,
      handCounts: [],
      leadingPlay: null,
      leadingHand: null,
      passedSeats: [],
      completedTricks: 0,
      finishedSeats: [],
    };
  }

  const tableActive =
    state.phase === "playing" || state.phase === "round-complete";
  const leadingPlay = tableActive ? state.trick.leadingPlay : null;

  return {
    phase: state.phase,
    availableActions: availableInteractiveGameActions(state),
    playerCount: state.config.playerCount,
    openingDraw: null,
    openingWinnerSeat: tableActive ? state.openingDraw.winnerSeat : null,
    leaderSeat: tableActive ? state.trick.leaderSeat : null,
    currentTurn: tableActive ? state.currentTurn : null,
    handCounts: tableActive ? state.hands.map((hand) => hand.length) : [],
    leadingPlay:
      leadingPlay === null
        ? null
        : {
            seat: leadingPlay.seat,
            cards: leadingPlay.cards,
          },
    leadingHand: leadingPlay === null ? null : classifyHand(leadingPlay.cards),
    passedSeats: tableActive ? state.trick.passedSeats : [],
    completedTricks: tableActive ? state.trick.completedTricks : 0,
    finishedSeats: tableActive ? (state.finishedSeats ?? []) : [],
  };
};
