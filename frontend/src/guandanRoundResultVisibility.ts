export interface GuandanRoundResultVisibilityState {
  finishOrder: number[];
  hand: unknown[];
  handCounts: number[];
  matchWinner: unknown | null;
  nextRoundPhase: unknown | null;
  playerCount: number | null;
  players: string[];
}

/**
 * Show the completed-round summary only in the short interval after every
 * player has finished and before preparation for the next round starts.
 *
 * The compatibility protocol intentionally keeps last-round winner fields for
 * scoring and tribute logic. They must not keep occupying the public table
 * after shuffling starts or fresh cards have been dealt.
 */
export const shouldShowCompletedRoundResult = (
  state: GuandanRoundResultVisibilityState,
): boolean => {
  const playerCount = state.playerCount ?? state.players.length;
  const freshCardsArePresent =
    state.hand.length > 0 || state.handCounts.some((count) => count > 0);

  return (
    playerCount >= 4 &&
    state.finishOrder.length === playerCount &&
    state.nextRoundPhase === null &&
    !freshCardsArePresent &&
    state.matchWinner === null
  );
};
