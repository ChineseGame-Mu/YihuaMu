import { RANKS, type Rank } from "./cards.js";
import { teamForSeat, type SupportedPlayerCount, type Team } from "./table.js";

export interface TeamLevels {
  readonly A: Rank;
  readonly B: Rank;
}

export interface RoundSettlement {
  readonly finishOrder: readonly number[];
  readonly winnerSeat: number;
  readonly winnerTeam: Team;
  readonly promotionSteps: number;
  readonly teamLevels: TeamLevels;
  readonly nextLevel: Rank;
  readonly nextLeadSeat: number;
  readonly matchWinner: Team | null;
}

export const INITIAL_TEAM_LEVELS: TeamLevels = { A: "2", B: "2" };

const advanceRank = (rank: Rank, steps: number): Rank => {
  const index = RANKS.indexOf(rank);
  return RANKS[Math.min(index + steps, RANKS.length - 1)]!;
};

const completeFinishOrder = (
  finishOrder: readonly number[],
  playerCount: SupportedPlayerCount,
): readonly number[] => {
  if (new Set(finishOrder).size !== finishOrder.length) {
    throw new Error("finish order cannot contain duplicate seats");
  }
  if (finishOrder.some((seat) => seat < 0 || seat >= playerCount)) {
    throw new Error("finish order contains a seat outside the table");
  }
  if (finishOrder.length === playerCount) return [...finishOrder];
  if (finishOrder.length !== playerCount - 1) {
    throw new Error("settlement requires all but at most the final seat");
  }
  const lastSeat = Array.from({ length: playerCount }, (_, seat) => seat).find(
    (seat) => !finishOrder.includes(seat),
  );
  if (lastSeat === undefined) throw new Error("unable to determine final seat");
  return [...finishOrder, lastSeat];
};

const fourPlayerPromotion = (finishOrder: readonly number[]): number => {
  const winner = finishOrder[0]!;
  const partner = (winner + 2) % 4;
  const partnerPlace = finishOrder.indexOf(partner) + 1;
  if (partnerPlace === 2) return 3;
  if (partnerPlace === 3) return 2;
  if (partnerPlace === 4) return 1;
  throw new Error("winner partner is missing from finish order");
};

export const settleRound = (
  playerCount: SupportedPlayerCount,
  finishOrder: readonly number[],
  levels: TeamLevels = INITIAL_TEAM_LEVELS,
): RoundSettlement => {
  const completed = completeFinishOrder(finishOrder, playerCount);
  const winnerSeat = completed[0]!;
  const winnerTeam = teamForSeat(winnerSeat);
  const currentLevel = levels[winnerTeam];
  const promotionSteps = playerCount === 4 ? fourPlayerPromotion(completed) : 1;
  const winsAtAce =
    currentLevel === "A" && (playerCount > 4 || promotionSteps >= 2);
  const nextWinnerLevel =
    currentLevel === "A" ? "A" : advanceRank(currentLevel, promotionSteps);
  const teamLevels: TeamLevels = {
    ...levels,
    [winnerTeam]: nextWinnerLevel,
  };

  return {
    finishOrder: completed,
    winnerSeat,
    winnerTeam,
    promotionSteps,
    teamLevels,
    nextLevel: nextWinnerLevel,
    nextLeadSeat: winnerSeat,
    matchWinner: winsAtAce ? winnerTeam : null,
  };
};
