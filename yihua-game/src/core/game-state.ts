import type { Card, Rank } from "./cards.js";
import {
  createDeck,
  dealHands,
  shuffleDeck,
  type DeckCard,
  type RandomSource,
} from "./deck.js";
import { runOpeningDraw, type OpeningDrawResult } from "./opening-draw.js";
import {
  buildRoundOutcome,
  buildRoundPlacements,
  type RoundOutcome,
  type RoundPlacement,
} from "./round-result.js";
import {
  createTableConfig,
  teamForSeat,
  teammateSeatsForSeat,
  type TableConfig,
} from "./table.js";
import {
  createTrickState,
  passTurn,
  playCardsWithLevel,
  type TrickState,
} from "./trick-state.js";

export type GamePhase = "lobby" | "opening-draw" | "playing" | "round-complete";

export const FIRST_ROUND_LEVEL_RANK: Rank = "2";

export interface LobbyState {
  readonly phase: "lobby";
  readonly config: TableConfig;
}

export interface OpeningDrawState {
  readonly phase: "opening-draw";
  readonly config: TableConfig;
  readonly openingDraw: OpeningDrawResult;
}

export interface PlayingState {
  readonly phase: "playing";
  readonly config: TableConfig;
  readonly openingDraw: OpeningDrawResult;
  readonly hands: readonly (readonly DeckCard[])[];
  readonly currentTurn: number;
  readonly trick: TrickState;
  readonly finishedSeats?: readonly number[];
}

export interface RoundCompleteState extends Omit<PlayingState, "phase"> {
  readonly phase: "round-complete";
  readonly winnerSeat: number;
  readonly finishedSeats: readonly number[];
  readonly placements: readonly RoundPlacement[];
  readonly outcome: RoundOutcome | null;
}

export type GameState =
  | LobbyState
  | OpeningDrawState
  | PlayingState
  | RoundCompleteState;

export const createLobbyState = (
  playerCount: number,
  botCount: number,
): LobbyState => ({
  phase: "lobby",
  config: createTableConfig(playerCount, botCount),
});

export const startOpeningDraw = (
  lobby: LobbyState,
  random: RandomSource = Math.random,
): OpeningDrawState => ({
  phase: "opening-draw",
  config: lobby.config,
  openingDraw: runOpeningDraw(
    createDeck(lobby.config.playerCount),
    lobby.config.playerCount,
    random,
  ),
});

export const dealAfterOpeningDraw = (
  opening: OpeningDrawState,
  random: RandomSource = Math.random,
): PlayingState => {
  const dealDeck = shuffleDeck(createDeck(opening.config.playerCount), random);
  const hands = dealHands(dealDeck, opening.config.playerCount);
  const trick = createTrickState(
    opening.config.playerCount,
    opening.openingDraw.winnerSeat,
  );

  return {
    phase: "playing",
    config: opening.config,
    openingDraw: opening.openingDraw,
    hands,
    currentTurn: trick.currentTurn,
    trick,
    finishedSeats: [],
  };
};

export const startGame = (
  lobby: LobbyState,
  random: RandomSource = Math.random,
): PlayingState =>
  dealAfterOpeningDraw(startOpeningDraw(lobby, random), random);

export const startNextRound = (
  completed: RoundCompleteState,
  random: RandomSource = Math.random,
): PlayingState => {
  const dealDeck = shuffleDeck(
    createDeck(completed.config.playerCount),
    random,
  );
  const hands = dealHands(dealDeck, completed.config.playerCount);
  const nextLeader = completed.outcome?.firstPlaceSeat ?? completed.winnerSeat;
  const trick = createTrickState(completed.config.playerCount, nextLeader);

  return {
    phase: "playing",
    config: completed.config,
    openingDraw: completed.openingDraw,
    hands,
    currentTurn: trick.currentTurn,
    trick,
    finishedSeats: [],
  };
};

const sameCard = (left: Card, right: Card): boolean => {
  if (left.kind !== right.kind) return false;
  if (left.kind === "joker" && right.kind === "joker") {
    return left.size === right.size;
  }
  return (
    left.kind === "suited" &&
    right.kind === "suited" &&
    left.suit === right.suit &&
    left.rank === right.rank
  );
};

const removeCardsFromHand = (
  hand: readonly DeckCard[],
  cards: readonly Card[],
): DeckCard[] => {
  const remaining = [...hand];
  for (const card of cards) {
    const index = remaining.findIndex((deckCard) =>
      sameCard(deckCard.card, card),
    );
    if (index < 0) {
      throw new Error("played card is not in seat's hand");
    }
    remaining.splice(index, 1);
  }
  return remaining;
};

const finishedSeatsOf = (state: PlayingState): readonly number[] =>
  state.finishedSeats ?? [];

const activeSeatsFor = (
  state: PlayingState,
  finishedSeats: readonly number[] = finishedSeatsOf(state),
): number[] =>
  Array.from({ length: state.config.playerCount }, (_, seat) => seat).filter(
    (seat) => !finishedSeats.includes(seat),
  );

const respondingSeatsFor = (
  leaderSeat: number,
  activeSeats: readonly number[],
  finishedSeats: readonly number[],
): number[] => {
  if (!finishedSeats.includes(leaderSeat)) return [...activeSeats];
  const leaderTeam = teamForSeat(leaderSeat);
  return activeSeats.filter((seat) => teamForSeat(seat) !== leaderTeam);
};

const catchLeadSeat = (
  state: PlayingState,
  finishedLeader: number,
  activeSeats: readonly number[],
): number | null => {
  const active = new Set(activeSeats);
  const teammates = teammateSeatsForSeat(
    state.config.playerCount,
    finishedLeader,
  ).filter((seat) => active.has(seat));
  if (teammates.length === 0) return null;
  return teammates.reduce((nearest, seat) => {
    const nearestDistance =
      (nearest - finishedLeader + state.config.playerCount) %
      state.config.playerCount;
    const seatDistance =
      (seat - finishedLeader + state.config.playerCount) %
      state.config.playerCount;
    return seatDistance < nearestDistance ? seat : nearest;
  });
};

export const playGameCards = (
  state: PlayingState,
  seat: number,
  cards: readonly Card[],
  levelRank: Rank = FIRST_ROUND_LEVEL_RANK,
): PlayingState | RoundCompleteState => {
  const priorFinishedSeats = finishedSeatsOf(state);
  if (priorFinishedSeats.includes(seat)) {
    throw new Error("finished seat cannot play");
  }
  const hand = state.hands[seat];
  if (hand === undefined) throw new Error("seat is outside the table");
  const remainingHand = removeCardsFromHand(hand, cards);
  const finishedSeats =
    remainingHand.length === 0
      ? [...priorFinishedSeats, seat]
      : [...priorFinishedSeats];
  const activeSeats = activeSeatsFor(state, finishedSeats);
  const rotationSeats = respondingSeatsFor(seat, activeSeats, finishedSeats);
  const playRotationSeats = rotationSeats.includes(seat)
    ? rotationSeats
    : [seat, ...rotationSeats];
  let trick = playCardsWithLevel(
    state.trick,
    seat,
    cards,
    levelRank,
    playRotationSeats,
  );

  if (
    remainingHand.length === 0 &&
    (rotationSeats.length === 0 || trick.currentTurn === seat) &&
    activeSeats.length > 0
  ) {
    const catchSeat =
      catchLeadSeat(state, seat, activeSeats) ?? activeSeats[0]!;
    trick = {
      ...trick,
      leaderSeat: catchSeat,
      currentTurn: catchSeat,
      leadingPlay: null,
      passedSeats: [],
      completedTricks: trick.completedTricks + 1,
    };
  }

  const hands = state.hands.map((currentHand, currentSeat) =>
    currentSeat === seat ? remainingHand : currentHand,
  );
  const nextState: PlayingState = {
    ...state,
    hands,
    finishedSeats,
    currentTurn: trick.currentTurn,
    trick,
  };

  if (finishedSeats.length < state.config.playerCount - 1) return nextState;

  const lastSeat = activeSeats[0];
  const finishOrder =
    lastSeat === undefined ? finishedSeats : [...finishedSeats, lastSeat];
  return completeRound(
    { ...nextState, finishedSeats: finishOrder },
    finishOrder[0] ?? seat,
  );
};

export const passGameTurn = (
  state: PlayingState,
  seat: number,
): PlayingState => {
  const finishedSeats = finishedSeatsOf(state);
  if (finishedSeats.includes(seat)) {
    throw new Error("finished seat cannot pass");
  }
  const activeSeats = activeSeatsFor(state, finishedSeats);
  const priorLeader = state.trick.leadingPlay?.seat ?? null;
  const rotationSeats =
    priorLeader === null
      ? activeSeats
      : respondingSeatsFor(priorLeader, activeSeats, finishedSeats);
  let trick = passTurn(state.trick, seat, rotationSeats);

  if (
    priorLeader !== null &&
    trick.leadingPlay === null &&
    finishedSeats.includes(priorLeader)
  ) {
    const catchSeat = catchLeadSeat(state, priorLeader, activeSeats);
    if (catchSeat !== null) {
      trick = { ...trick, leaderSeat: catchSeat, currentTurn: catchSeat };
    }
  }

  return { ...state, currentTurn: trick.currentTurn, trick };
};

export const completeRound = (
  state: PlayingState,
  winnerSeat: number,
): RoundCompleteState => {
  if (
    !Number.isInteger(winnerSeat) ||
    winnerSeat < 0 ||
    winnerSeat >= state.config.playerCount
  ) {
    throw new Error("winner seat is outside the table");
  }

  const finishedSeats = state.finishedSeats ?? [];
  const placements =
    finishedSeats.length === state.config.playerCount
      ? buildRoundPlacements(state.config.playerCount, finishedSeats)
      : [];
  const outcome = placements.length > 0 ? buildRoundOutcome(placements) : null;
  if (outcome !== null && outcome.firstPlaceSeat !== winnerSeat) {
    throw new Error("winner seat must match first place");
  }

  return {
    ...state,
    phase: "round-complete",
    winnerSeat,
    finishedSeats,
    placements,
    outcome,
  };
};
