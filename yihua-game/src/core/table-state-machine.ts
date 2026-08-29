import type { Card, Rank } from "./cards.js";
import type { DeckCard, RandomSource } from "./deck.js";
import {
  createOpeningDrawSession,
  drawOpeningAttempt,
  type OpeningDrawSession,
} from "./opening-draw.js";
import {
  teamForSeat,
  teammateSeatsForSeat,
  type SupportedPlayerCount,
} from "./table.js";
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
  if (state.phase !== "playing" || state.trick === null)
    throw new Error("table is not in the playing phase");
  return state.trick;
};
const respondingSeatsFor = (
  leaderSeat: number,
  activeSeats: readonly number[],
): number[] => {
  if (activeSeats.includes(leaderSeat)) return [...activeSeats];
  const leaderTeam = teamForSeat(leaderSeat);
  return activeSeats.filter((seat) => teamForSeat(seat) !== leaderTeam);
};
const catchLeadSeat = (
  state: TableRoundState,
  finishedLeader: number,
  activeSeats: readonly number[],
): number | null => {
  const active = new Set(activeSeats);
  const teammates = teammateSeatsForSeat(
    state.playerCount,
    finishedLeader,
  ).filter((seat) => active.has(seat));
  if (teammates.length === 0) return null;
  return teammates.reduce((nearest, seat) => {
    const nearestDistance =
      (nearest - finishedLeader + state.playerCount) % state.playerCount;
    const seatDistance =
      (seat - finishedLeader + state.playerCount) % state.playerCount;
    return seatDistance < nearestDistance ? seat : nearest;
  });
};
const closeFinishedLeaderTrick = (
  state: TableRoundState,
  finishedLeader: number,
  activeSeats: readonly number[],
  trick: TrickState,
): TrickState => {
  const catchSeat = catchLeadSeat(state, finishedLeader, activeSeats);
  if (catchSeat === null) return trick;
  return {
    ...trick,
    leaderSeat: catchSeat,
    currentTurn: catchSeat,
    leadingPlay: null,
    passedSeats: [],
    completedTricks: trick.completedTricks + 1,
  };
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
  if (state.phase !== "opening-draw")
    throw new Error("opening draw is already complete");
  const openingDraw = drawOpeningAttempt(state.openingDraw, state.playerCount);
  if (openingDraw.winnerSeat === null) return { ...state, openingDraw };
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
  if (!finishesHand) return { ...state, trick: nextTrick };
  const finishingOrder = [...state.finishingOrder, seat];
  if (activeSeats.length === 1)
    return {
      ...state,
      phase: "round-complete",
      trick: nextTrick,
      activeSeats,
      finishingOrder: [...finishingOrder, activeSeats[0]!],
    };
  return { ...state, trick: nextTrick, activeSeats, finishingOrder };
};
const tablePlayContext = (
  state: TableRoundState,
  seat: number,
  options: TablePlayOptions,
): {
  trick: TrickState;
  activeSeats: readonly number[];
  rotationSeats: readonly number[];
  finishesHand: boolean;
} => {
  const trick = requirePlayingState(state);
  if (!state.activeSeats.includes(seat))
    throw new Error("finished seat cannot play");
  const finishesHand = options.finishesHand === true;
  const activeSeats = finishesHand
    ? state.activeSeats.filter((activeSeat) => activeSeat !== seat)
    : [...state.activeSeats];
  if (activeSeats.length === 0)
    throw new Error("table must retain at least one active seat");
  const rotationSeats = finishesHand
    ? respondingSeatsFor(seat, activeSeats)
    : activeSeats;
  return { trick, activeSeats, rotationSeats, finishesHand };
};
const adjustFinishedLeaderAfterPlay = (
  state: TableRoundState,
  seat: number,
  activeSeats: readonly number[],
  rotationSeats: readonly number[],
  finishesHand: boolean,
  trick: TrickState,
): TrickState => {
  if (!finishesHand || rotationSeats.length > 0) return trick;
  return closeFinishedLeaderTrick(state, seat, activeSeats, trick);
};
export const playTableCards = (
  state: TableRoundState,
  seat: number,
  cards: readonly Card[],
  options: TablePlayOptions = {},
): TableRoundState => {
  const { trick, activeSeats, rotationSeats, finishesHand } = tablePlayContext(
    state,
    seat,
    options,
  );
  const playedTrick = playCards(trick, seat, cards, rotationSeats);
  const nextTrick = adjustFinishedLeaderAfterPlay(
    state,
    seat,
    activeSeats,
    rotationSeats,
    finishesHand,
    playedTrick,
  );
  return finishTablePlay(state, seat, nextTrick, activeSeats, finishesHand);
};
export const playTableCardsWithLevel = (
  state: TableRoundState,
  seat: number,
  cards: readonly Card[],
  levelRank: Rank,
  options: TablePlayOptions = {},
): TableRoundState => {
  const { trick, activeSeats, rotationSeats, finishesHand } = tablePlayContext(
    state,
    seat,
    options,
  );
  const playedTrick = playCardsWithLevel(
    trick,
    seat,
    cards,
    levelRank,
    rotationSeats,
  );
  const nextTrick = adjustFinishedLeaderAfterPlay(
    state,
    seat,
    activeSeats,
    rotationSeats,
    finishesHand,
    playedTrick,
  );
  return finishTablePlay(state, seat, nextTrick, activeSeats, finishesHand);
};
export const passTableTurn = (
  state: TableRoundState,
  seat: number,
): TableRoundState => {
  const trick = requirePlayingState(state);
  if (!state.activeSeats.includes(seat))
    throw new Error("finished seat cannot pass");
  const priorLeader = trick.leadingPlay?.seat ?? null;
  const rotationSeats =
    priorLeader === null
      ? state.activeSeats
      : respondingSeatsFor(priorLeader, state.activeSeats);
  let nextTrick = passTurn(trick, seat, rotationSeats);
  if (
    priorLeader !== null &&
    nextTrick.leadingPlay === null &&
    !state.activeSeats.includes(priorLeader)
  ) {
    const catchSeat = catchLeadSeat(state, priorLeader, state.activeSeats);
    if (catchSeat !== null)
      nextTrick = {
        ...nextTrick,
        leaderSeat: catchSeat,
        currentTurn: catchSeat,
      };
  }
  return { ...state, trick: nextTrick };
};
export const startNextTableRound = (
  state: TableRoundState,
): TableRoundState => {
  if (state.phase !== "round-complete")
    throw new Error("current round is not complete");
  const winnerSeat = state.finishingOrder[0];
  if (winnerSeat === undefined)
    throw new Error("completed round has no winner");
  return {
    ...state,
    phase: "playing",
    trick: createTrickState(state.playerCount, winnerSeat),
    activeSeats: allSeats(state.playerCount),
    finishingOrder: [],
  };
};
