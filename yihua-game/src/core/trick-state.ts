import type { Card } from "./cards.js";
import { canHandBeat, classifyHand, type ClassifiedHand } from "./hand.js";
import type { SupportedPlayerCount } from "./table.js";

export interface TablePlay {
  readonly seat: number;
  readonly cards: readonly Card[];
  readonly hand: ClassifiedHand;
}

export interface TrickState {
  readonly playerCount: SupportedPlayerCount;
  readonly leaderSeat: number;
  readonly currentTurn: number;
  readonly leadingPlay: TablePlay | null;
  readonly plays: readonly TablePlay[];
  readonly passedSeats: readonly number[];
  readonly completedTricks: number;
}

const nextSeat = (seat: number, playerCount: number) =>
  (seat + 1) % playerCount;

export const createTrickState = (
  playerCount: SupportedPlayerCount,
  leaderSeat: number,
): TrickState => {
  if (
    !Number.isInteger(leaderSeat) ||
    leaderSeat < 0 ||
    leaderSeat >= playerCount
  ) {
    throw new Error("leader seat is outside the table");
  }
  return {
    playerCount,
    leaderSeat,
    currentTurn: leaderSeat,
    leadingPlay: null,
    plays: [],
    passedSeats: [],
    completedTricks: 0,
  };
};

export const playCards = (
  state: TrickState,
  seat: number,
  cards: readonly Card[],
): TrickState => {
  if (seat !== state.currentTurn) throw new Error("not this seat's turn");
  const hand = classifyHand(cards);
  if (hand.kind === "invalid") throw new Error("invalid hand");
  if (
    state.leadingPlay !== null &&
    !canHandBeat(hand, state.leadingPlay.hand)
  ) {
    throw new Error("played hand does not beat the current hand");
  }

  const play: TablePlay = { seat, cards: [...cards], hand };
  return {
    ...state,
    leaderSeat: seat,
    currentTurn: nextSeat(seat, state.playerCount),
    leadingPlay: play,
    plays: [...state.plays, play],
    passedSeats: [],
  };
};

export const passTurn = (state: TrickState, seat: number): TrickState => {
  if (seat !== state.currentTurn) throw new Error("not this seat's turn");

  if (state.leadingPlay === null) {
    throw new Error("leader cannot pass");
  }

  const passedSeats = [...state.passedSeats, seat];
  if (passedSeats.length >= state.playerCount - 1) {
    return {
      ...state,
      currentTurn: state.leadingPlay.seat,
      leaderSeat: state.leadingPlay.seat,
      leadingPlay: null,
      passedSeats: [],
      completedTricks: state.completedTricks + 1,
    };
  }

  return {
    ...state,
    currentTurn: nextSeat(seat, state.playerCount),
    passedSeats,
  };
};
