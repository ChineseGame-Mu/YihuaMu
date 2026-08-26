import type { Card } from "./cards.js";
import {
  createDeck,
  dealHands,
  shuffleDeck,
  type DeckCard,
  type RandomSource,
} from "./deck.js";
import { runOpeningDraw, type OpeningDrawResult } from "./opening-draw.js";
import { createTableConfig, type TableConfig } from "./table.js";
import {
  createTrickState,
  passTurn,
  playCards,
  type TrickState,
} from "./trick-state.js";

export type GamePhase = "lobby" | "opening-draw" | "playing" | "round-complete";

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
}

export interface RoundCompleteState extends Omit<PlayingState, "phase"> {
  readonly phase: "round-complete";
  readonly winnerSeat: number;
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
  };
};

export const startGame = (
  lobby: LobbyState,
  random: RandomSource = Math.random,
): PlayingState => dealAfterOpeningDraw(startOpeningDraw(lobby, random), random);

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

export const playGameCards = (
  state: PlayingState,
  seat: number,
  cards: readonly Card[],
): PlayingState | RoundCompleteState => {
  const trick = playCards(state.trick, seat, cards);
  const hand = state.hands[seat];
  if (hand === undefined) throw new Error("seat is outside the table");
  const remainingHand = removeCardsFromHand(hand, cards);
  const hands = state.hands.map((currentHand, currentSeat) =>
    currentSeat === seat ? remainingHand : currentHand,
  );
  const nextState: PlayingState = {
    ...state,
    hands,
    currentTurn: trick.currentTurn,
    trick,
  };
  return remainingHand.length === 0
    ? completeRound(nextState, seat)
    : nextState;
};

export const passGameTurn = (
  state: PlayingState,
  seat: number,
): PlayingState => {
  const trick = passTurn(state.trick, seat);
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

  return {
    ...state,
    phase: "round-complete",
    winnerSeat,
  };
};
