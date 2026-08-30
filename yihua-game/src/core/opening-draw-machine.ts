import type { DeckCard, RandomSource } from "./deck.js";
import {
  createOpeningDrawSession,
  drawOpeningAttempt,
  type OpeningDrawAttempt,
  type OpeningDrawResult,
  type OpeningDrawSession,
} from "./opening-draw.js";
import type { SupportedPlayerCount } from "./table.js";

export type OpeningDrawMachinePhase = "drawing" | "complete";

export interface OpeningDrawMachineState {
  readonly phase: OpeningDrawMachinePhase;
  readonly playerCount: SupportedPlayerCount;
  readonly session: OpeningDrawSession;
}

export interface OpeningDrawMachineProgress {
  readonly phase: OpeningDrawMachinePhase;
  readonly attemptsCompleted: number;
  readonly cardsDrawn: number;
  readonly cardsRemaining: number;
  readonly winnerSeat: number | null;
  readonly lastAttempt: OpeningDrawAttempt | null;
}

export interface OpeningDrawMachinePrompt {
  readonly phase: OpeningDrawMachinePhase;
  readonly canDraw: boolean;
  readonly attemptNumber: number | null;
  readonly isRedraw: boolean;
  readonly seatsToDraw: readonly number[];
  readonly cardsRequired: number;
}

export const createOpeningDrawMachine = (
  deck: readonly DeckCard[],
  playerCount: SupportedPlayerCount,
  random: RandomSource = Math.random,
): OpeningDrawMachineState => ({
  phase: "drawing",
  playerCount,
  session: createOpeningDrawSession(deck, random),
});

export const advanceOpeningDrawMachine = (
  state: OpeningDrawMachineState,
): OpeningDrawMachineState => {
  if (state.phase === "complete") {
    throw new Error("opening draw machine is already complete");
  }

  const session = drawOpeningAttempt(state.session, state.playerCount);
  return {
    ...state,
    phase: session.winnerSeat === null ? "drawing" : "complete",
    session,
  };
};

export const completeOpeningDrawMachine = (
  state: OpeningDrawMachineState,
): OpeningDrawMachineState => {
  let current = state;
  while (current.phase !== "complete") {
    current = advanceOpeningDrawMachine(current);
  }
  return current;
};

export const openingDrawMachineProgress = (
  state: OpeningDrawMachineState,
): OpeningDrawMachineProgress => ({
  phase: state.phase,
  attemptsCompleted: state.session.attempts.length,
  cardsDrawn: state.session.attempts.reduce(
    (total, attempt) => total + attempt.cards.length,
    0,
  ),
  cardsRemaining: state.session.remainingCards.length,
  winnerSeat: state.session.winnerSeat,
  lastAttempt:
    state.session.attempts.length === 0
      ? null
      : state.session.attempts[state.session.attempts.length - 1]!,
});

export const openingDrawMachinePrompt = (
  state: OpeningDrawMachineState,
): OpeningDrawMachinePrompt => {
  const canDraw = state.phase === "drawing";
  const attemptsCompleted = state.session.attempts.length;
  const lastAttempt = state.session.attempts[attemptsCompleted - 1] ?? null;

  return {
    phase: state.phase,
    canDraw,
    attemptNumber: canDraw ? attemptsCompleted + 1 : null,
    isRedraw:
      canDraw && lastAttempt !== null && lastAttempt.winnerSeat === null,
    seatsToDraw: canDraw
      ? Array.from({ length: state.playerCount }, (_, seat) => seat)
      : [],
    cardsRequired: canDraw ? state.playerCount : 0,
  };
};

export const openingDrawMachineResult = (
  state: OpeningDrawMachineState,
): OpeningDrawResult | null =>
  state.session.winnerSeat === null
    ? null
    : {
        attempts: state.session.attempts,
        winnerSeat: state.session.winnerSeat,
      };
