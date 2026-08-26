import { classifyHand, type ClassifiedHand } from "./hand.js";
import type { Card } from "./cards.js";
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
  const play: TablePlay = { seat, cards: [...cards], hand };
  return {
    ...state,
    currentTurn: nextSeat(seat, state.playerCount),
    leadingPlay: play,
    plays: [...state.plays, play],
    passedSeats: [],
  };
};

export const passTurn = (state: TrickState, seat: number): TrickState => {
  if (seat !== state.currentTurn) throw new Error("not this seat's turn");
  if (state.leadingPlay === null) throw new Error("leader cannot pass");
  return {
    ...state,
    currentTurn: nextSeat(seat, state.playerCount),
    passedSeats: [...state.passedSeats, seat],
  };
};
