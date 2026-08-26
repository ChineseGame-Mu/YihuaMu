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

export const startGame = (
  lobby: LobbyState,
  random: RandomSource = Math.random,
): PlayingState => {
  const openingDeck = createDeck(lobby.config.playerCount);
  const openingDraw = runOpeningDraw(
    openingDeck,
    lobby.config.playerCount,
    random,
  );
  const dealDeck = shuffleDeck(createDeck(lobby.config.playerCount), random);
  const hands = dealHands(dealDeck, lobby.config.playerCount);
  const trick = createTrickState(
    lobby.config.playerCount,
    openingDraw.winnerSeat,
  );

  return {
    phase: "playing",
    config: lobby.config,
    openingDraw,
    hands,
    currentTurn: trick.currentTurn,
    trick,
  };
};

export const playGameCards = (
  state: PlayingState,
  seat: number,
  cards: readonly Card[],
): PlayingState => {
  const trick = playCards(state.trick, seat, cards);
  return { ...state, currentTurn: trick.currentTurn, trick };
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
