export type GuandanNextRoundPhase = "awaiting_shuffle" | "awaiting_deal" | null;

interface GuandanDealTransition {
  previousHandSize: number;
  currentHandSize: number;
  previousNextRoundPhase: GuandanNextRoundPhase;
  nextRoundPhase: GuandanNextRoundPhase;
  playerCount: number;
  alreadyAnimated: boolean;
}

/**
 * A deal animation represents a real deal, not an arbitrary hand-size change.
 * Tribute and return-tribute temporarily remove/add one card and must never
 * replay the whole-deck animation.
 */
export const shouldAnimateGuandanDeal = ({
  previousHandSize,
  currentHandSize,
  previousNextRoundPhase,
  nextRoundPhase,
  playerCount,
  alreadyAnimated,
}: GuandanDealTransition): boolean => {
  if (playerCount < 4 || alreadyAnimated || currentHandSize <= 0) return false;

  const nextRoundActuallyStarted =
    previousNextRoundPhase === "awaiting_deal" && nextRoundPhase === null;
  const initialDealArrived =
    previousNextRoundPhase === null &&
    nextRoundPhase === null &&
    previousHandSize === 0;

  return nextRoundActuallyStarted || initialDealArrived;
};
