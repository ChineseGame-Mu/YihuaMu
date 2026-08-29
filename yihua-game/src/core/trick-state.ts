import type { Card, Rank } from "./cards.js";
import { canHandBeat, classifyHand, type ClassifiedHand } from "./hand.js";
import { classifyHandWithLevel } from "./level-hand.js";
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

const activeSeatsOrAll = (
  state: TrickState,
  activeSeats?: readonly number[],
): readonly number[] => {
  if (activeSeats === undefined) {
    return Array.from({ length: state.playerCount }, (_, seat) => seat);
  }

  const unique = [...new Set(activeSeats)];
  if (
    unique.length === 0 ||
    unique.some(
      (seat) =>
        !Number.isInteger(seat) || seat < 0 || seat >= state.playerCount,
    )
  ) {
    throw new Error("active seats must be valid table seats");
  }

  return unique;
};

const nextActiveSeat = (
  state: TrickState,
  seat: number,
  activeSeats?: readonly number[],
): number => {
  const active = new Set(activeSeatsOrAll(state, activeSeats));
  for (let offset = 1; offset <= state.playerCount; offset += 1) {
    const candidate = (seat + offset) % state.playerCount;
    if (active.has(candidate)) return candidate;
  }
  return seat;
};

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

const applyPlay = (
  state: TrickState,
  seat: number,
  cards: readonly Card[],
  hand: ClassifiedHand,
  activeSeats?: readonly number[],
): TrickState => {
  if (seat !== state.currentTurn) throw new Error("not this seat's turn");

  // activeSeats is the post-play rotation snapshot. A player who empties their
  // hand on this play may therefore already be absent from the list.
  const active = activeSeatsOrAll(state, activeSeats);

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
    currentTurn: nextActiveSeat(state, seat, active),
    leadingPlay: play,
    plays: [...state.plays, play],
    passedSeats: [],
  };
};

export const playCards = (
  state: TrickState,
  seat: number,
  cards: readonly Card[],
  activeSeats?: readonly number[],
): TrickState => applyPlay(state, seat, cards, classifyHand(cards), activeSeats);

export const playCardsWithLevel = (
  state: TrickState,
  seat: number,
  cards: readonly Card[],
  levelRank: Rank,
  activeSeats?: readonly number[],
): TrickState =>
  applyPlay(
    state,
    seat,
    cards,
    classifyHandWithLevel(cards, levelRank),
    activeSeats,
  );

export const passTurn = (
  state: TrickState,
  seat: number,
  activeSeats?: readonly number[],
): TrickState => {
  if (seat !== state.currentTurn) throw new Error("not this seat's turn");

  if (state.leadingPlay === null) {
    throw new Error("leader cannot pass");
  }

  const active = activeSeatsOrAll(state, activeSeats);
  if (!active.includes(seat)) {
    throw new Error("current turn must be an active seat");
  }

  const requiredPasses = active.filter(
    (activeSeat) => activeSeat !== state.leadingPlay?.seat,
  ).length;
  const previouslyPassedActiveSeats = state.passedSeats.filter((passedSeat) =>
    active.includes(passedSeat),
  );
  const passedSeats = [...new Set([...previouslyPassedActiveSeats, seat])];
  if (passedSeats.length >= requiredPasses) {
    const completedLeader = state.leadingPlay.seat;
    const nextLeader = active.includes(completedLeader)
      ? completedLeader
      : nextActiveSeat(state, completedLeader, active);
    return {
      ...state,
      currentTurn: nextLeader,
      leaderSeat: nextLeader,
      leadingPlay: null,
      passedSeats: [],
      completedTricks: state.completedTricks + 1,
    };
  }

  return {
    ...state,
    currentTurn: nextActiveSeat(state, seat, active),
    passedSeats,
  };
};
