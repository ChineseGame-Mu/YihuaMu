import {
  passGameTurn,
  playGameCards,
  type PlayingState,
  type RoundCompleteState,
} from "./game-state.js";

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

export const playGameCardIds = (
  state: PlayingState,
  seat: number,
  cardIds: readonly string[],
): PlayingState | RoundCompleteState => {
  const selected = selectedCards(state, seat, cardIds);
  const next = playGameCards(
    state,
    seat,
    selected.map(({ card }) => card),
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
