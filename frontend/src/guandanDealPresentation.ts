export interface GuandanDealPresentation {
  dealtCards: number;
  remainingCards: number;
  targetSeat: number | null;
  totalCards: number;
}

const positiveInteger = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

export const guandanDealPresentation = (
  step: number | null,
  playerCount: number,
  cardsPerPlayer: number,
): GuandanDealPresentation => {
  const seats = positiveInteger(playerCount);
  const handSize = positiveInteger(cardsPerPlayer);
  const totalCards = seats * handSize;
  const dealtCards =
    step === null
      ? totalCards
      : Math.max(0, Math.min(totalCards, Math.floor(step)));

  return {
    dealtCards,
    remainingCards: totalCards - dealtCards,
    targetSeat:
      seats > 0 && dealtCards < totalCards ? dealtCards % seats : null,
    totalCards,
  };
};

export const guandanDealtCardsForSeat = (
  step: number | null,
  playerCount: number,
  cardsPerPlayer: number,
  seat: number,
): number => {
  const presentation = guandanDealPresentation(
    step,
    playerCount,
    cardsPerPlayer,
  );
  if (step === null || playerCount <= 0 || seat < 0 || seat >= playerCount) {
    return step === null ? positiveInteger(cardsPerPlayer) : 0;
  }
  const completePasses = Math.floor(presentation.dealtCards / playerCount);
  const partialPass = presentation.dealtCards % playerCount;
  return Math.min(
    positiveInteger(cardsPerPlayer),
    completePasses + (seat < partialPass ? 1 : 0),
  );
};
