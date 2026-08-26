import {
  createDeck,
  dealHands,
  shuffleDeck,
  type DeckCard,
  type RandomSource,
} from "./deck.js";
import { runOpeningDraw, type OpeningDrawResult } from "./opening-draw.js";
import { createTableConfig, type TableConfig } from "./table.js";

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

  return {
    phase: "playing",
    config: lobby.config,
    openingDraw,
    hands,
    currentTurn: openingDraw.winnerSeat,
  };
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
