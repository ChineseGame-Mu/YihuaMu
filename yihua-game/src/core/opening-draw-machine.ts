import type { DeckCard, RandomSource } from "./deck.js";
import {
  createOpeningDrawSession,
  drawOpeningAttempt,
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

export const openingDrawMachineResult = (
  state: OpeningDrawMachineState,
): OpeningDrawResult | null =>
  state.session.winnerSeat === null
    ? null
    : {
        attempts: state.session.attempts,
        winnerSeat: state.session.winnerSeat,
      };
