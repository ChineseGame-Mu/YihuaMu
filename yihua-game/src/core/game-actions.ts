import type { Rank } from "./cards.js";
import {
  FIRST_ROUND_LEVEL_RANK,
  passGameTurn,
  playGameCards,
  type PlayingState,
  type RoundCompleteState,
} from "./game-state.js";
import { type ClassifiedHand } from "./hand.js";
import { classifyHandWithLevel } from "./level-hand.js";

const selectedCards = (
  state: PlayingState,
  seat: number,
  cardIds: readonly string[],
) => {
  if (cardIds.length === 0) {
    throw new Error("at least one card id is required");
  }
  if (new Set(cardIds).size !== cardIds.length) {
    throw new Error("card ids must be unique");
  }

  const hand = state.hands[seat];
  if (hand === undefined) {
    throw new Error("seat is outside the table");
  }

  return cardIds.map((cardId) => {
    const card = hand.find(({ id }) => id === cardId);
    if (!card) {
      throw new Error(`card ${cardId} is not in seat's hand`);
    }
    return card;
  });
};

const currentLevelRank = (state: PlayingState, levelRank?: Rank): Rank =>
  levelRank ?? state.levelRank ?? FIRST_ROUND_LEVEL_RANK;

export const classifyGameCardIds = (
  state: PlayingState,
  seat: number,
  cardIds: readonly string[],
  levelRank?: Rank,
): ClassifiedHand =>
  classifyHandWithLevel(
    selectedCards(state, seat, cardIds).map(({ card }) => card),
    currentLevelRank(state, levelRank),
  );

export const playGameCardIds = (
  state: PlayingState,
  seat: number,
  cardIds: readonly string[],
  levelRank?: Rank,
): PlayingState | RoundCompleteState => {
  const selected = selectedCards(state, seat, cardIds);
  const next = playGameCards(
    state,
    seat,
    selected.map(({ card }) => card),
    currentLevelRank(state, levelRank),
  );
  const selectedIds = new Set(cardIds);
  const exactRemainingHand = state.hands[seat]!.filter(
    ({ id }) => !selectedIds.has(id),
  );

  return {
    ...next,
    hands: next.hands.map((hand, currentSeat) =>
      currentSeat === seat ? exactRemainingHand : hand,
    ),
  };
};

export const passGameSeat = (state: PlayingState, seat: number): PlayingState =>
  passGameTurn(state, seat);
