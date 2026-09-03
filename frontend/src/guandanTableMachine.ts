export type GuandanTablePhase =
  | "waiting"
  | "initial_draw"
  | "dealing"
  | "playing"
  | "round_complete"
  | "awaiting_shuffle"
  | "awaiting_deal"
  | "match_complete";

export interface GuandanTableMachineInput {
  playerCount: number | null;
  initialDrawWinner: number | null;
  handCounts: number[];
  turn: number | null;
  finishOrder: number[];
  nextRoundPhase: "awaiting_shuffle" | "awaiting_deal" | null;
  matchWinner: unknown;
}

/** Pure UI-independent table state derivation used by the clean-room client. */
export const deriveGuandanTablePhase = (
  state: GuandanTableMachineInput,
): GuandanTablePhase => {
  if (state.matchWinner !== null) return "match_complete";
  if (state.nextRoundPhase === "awaiting_shuffle") return "awaiting_shuffle";
  if (state.nextRoundPhase === "awaiting_deal") return "awaiting_deal";

  const playerCount = state.playerCount ?? 0;
  if (playerCount < 4) return "waiting";
  if (state.initialDrawWinner === null) return "initial_draw";

  const activeHands = state.handCounts.filter((count) => count > 0).length;
  if (state.finishOrder.length > 0 && activeHands <= 1) return "round_complete";
  if (state.turn !== null && state.handCounts.length === playerCount)
    return "playing";
  return "dealing";
};
