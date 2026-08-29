import type { Card, Rank } from "./cards.js";
import type { DeckCard, RandomSource } from "./deck.js";
import {
  createOpeningDrawSession,
  drawOpeningAttempt,
  type OpeningDrawSession,
} from "./opening-draw.js";
import type { SupportedPlayerCount } from "./table.js";
import {
  createTrickState,
  passTurn,
  playCards,
  playCardsWithLevel,
  type TrickState,
} from "./trick-state.js";

export type TableRoundPhase = "opening-draw" | "playing" | "round-complete";

export interface TableRoundState {
  readonly playerCount: SupportedPlayerCount;
  readonly phase: TableRoundPhase;
  readonly openingDraw: OpeningDrawSession;
  readonly trick: TrickState | null;
  readonly activeSeats: readonly number[];
  readonly finishingOrder: readonly number[];
}

export interface TablePlayOptions {
  readonly finishesHand?: boolean;
}

const allSeats = (playerCount: SupportedPlayerCount): number[] =>
  Array.from({ length: playerCount }, (_, seat) => seat);

const requirePlayingState = (state: TableRoundState): TrickState => {
  if (state.phase !== "playing" || state.trick === null) {
    throw new Error("table is not in the playing phase");
  }
  return state.trick;
};

export const createTableRoundState = (
  deck: readonly DeckCard[],
  playerCount: SupportedPlayerCount,
  random: RandomSource = Math.random,
): TableRoundState => ({
  playerCount,
  phase: "opening-draw",
  openingDraw: createOpeningDrawSession(deck, random),
  trick: null,
  activeSeats: allSeats(playerCount),
  finishingOrder: [],
});

export const advanceTableOpeningDraw = (
  state: TableRoundState,
): TableRoundState => {
  if (state.phase !== "opening-draw") {
    throw new Error("opening draw is already complete");
  }

  const openingDraw = drawOpeningAttempt(state.openingDraw, state.playerCount);
  if (openingDraw.winnerSeat === null) {
    return { ...state, openingDraw };
  }

  return {
    ...state,
    phase: "playing",
    openingDraw,
    trick: createTrickState(state.playerCount, openingDraw.winnerSeat),
  };
};

const finishTablePlay = (
  state: TableRoundState,
  seat: number,
  nextTrick: TrickState,
  activeSeats: readonly number[],
  finishesHand: boolean,
): TableRoundState => {
  if (!finishesHand) {
    return { ...state, trick: nextTrick };
  }

  const finishingOrder = [...state.finishingOrder, seat];
  if (activeSeats.length === 1) {
    return {
      ...state,
      phase: "round-complete",
      trick: nextTrick,
      activeSeats,
      finishingOrder: [...finishingOrder, activeSeats[0]!],
    };
  }

  return {
    ...state,
    trick: nextTrick,
    activeSeats,
    finishingOrder,
  };
};

const tablePlayContext = (
  state: TableRoundState,
  seat: number,
  options: TablePlayOptions,
): {
  trick: TrickState;
  activeSeats: readonly number[];
  finishesHand: boolean;
} => {
  const trick = requirePlayingState(state);
  if (!state.activeSeats.includes(seat)) {
    throw new Error("finished seat cannot play");
  }

  const finishesHand = options.finishesHand === true;
  const activeSeats = finishesHand
    ? state.activeSeats.filter((activeSeat) => activeSeat !== seat)
    : [...state.activeSeats];

  if (activeSeats.length === 0) {
    throw new Error("table must retain at least one active seat");
  }

  return { trick, activeSeats, finishesHand };
};

export const playTableCards = (
  state: TableRoundState,
  seat: number,
  cards: readonly Card[],
  options: TablePlayOptions = {},
): TableRoundState => {
  const { trick, activeSeats, finishesHand } = tablePlayContext(
    state,
    seat,
    options,
  );
  const nextTrick = playCards(trick, seat, cards, activeSeats);
  return finishTablePlay(state, seat, nextTrick, activeSeats, finishesHand);
};

export const playTableCardsWithLevel = (
  state: TableRoundState,
  seat: number,
  cards: readonly Card[],
  levelRank: Rank,
  options: TablePlayOptions = {},
): TableRoundState => {
  const { trick, activeSeats, finishesHand } = tablePlayContext(
    state,
    seat,
    options,
  );
  const nextTrick = playCardsWithLevel(
    trick,
    seat,
    cards,
    levelRank,
    activeSeats,
  );
  return finishTablePlay(state, seat, nextTrick, activeSeats, finishesHand);
};

export const passTableTurn = (
  state: TableRoundState,
  seat: number,
): TableRoundState => {
  const trick = requirePlayingState(state);
  if (!state.activeSeats.includes(seat)) {
    throw new Error("finished seat cannot pass");
  }

  return {
    ...state,
    trick: passTurn(trick, seat, state.activeSeats),
  };
};

export const startNextTableRound = (
  state: TableRoundState,
): TableRoundState => {
  if (state.phase !== "round-complete") {
    throw new Error("current round is not complete");
  }

  const winnerSeat = state.finishingOrder[0];
  if (winnerSeat === undefined) {
    throw new Error("completed round has no winner");
  }

  return {
    ...state,
    phase: "playing",
    trick: createTrickState(state.playerCount, winnerSeat),
    activeSeats: allSeats(state.playerCount),
    finishingOrder: [],
  };
};
