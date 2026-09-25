import { RANKS, type Card, type Rank } from "./cards.js";
import type { DeckCard } from "./deck.js";
import type { RoundPlacement } from "./round-result.js";
import {
  antiTributeBigJokerRequirement,
  isSupportedPlayerCount,
  teamForSeat,
  type Team,
} from "./table.js";

export interface TeamLevels {
  readonly A: Rank;
  readonly B: Rank;
}

export interface PromotionResult {
  readonly team: Team;
  readonly steps: PromotionSteps;
  readonly before: Rank;
  readonly after: Rank;
  readonly passedA: boolean;
}

export type PromotionSteps = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface TributeTransfer {
  readonly fromSeat: number;
  readonly toSeat: number;
}

export interface TributePlan {
  readonly kind: "none" | "single" | "double" | "anti-tribute";
  readonly transfers: readonly TributeTransfer[];
}

export const initialTeamLevels = (): TeamLevels => ({ A: "2", B: "2" });

const advanceRank = (
  rank: Rank,
  steps: number,
): { rank: Rank; passedA: boolean } => {
  const index = RANKS.indexOf(rank);
  const next = index + steps;
  if (next > RANKS.indexOf("A")) return { rank: "A", passedA: true };
  return { rank: RANKS[next]!, passedA: false };
};

export const promotionForPlacements = (
  placements: readonly RoundPlacement[],
  levels: TeamLevels,
): PromotionResult => {
  if (!isSupportedPlayerCount(placements.length)) {
    throw new Error(
      "competitive promotion requires 4, 6, 8, 10, 12, or 14 placements",
    );
  }
  const winner = placements[0]!.team;
  const winnerPlaces = placements
    .filter((placement) => placement.team === winner)
    .map((placement) => placement.place)
    .sort((left, right) => left - right);
  const steps = promotionStepsForPlaces(placements.length, winnerPlaces);
  const before = levels[winner];
  const advanced = advanceRank(before, steps);
  return {
    team: winner,
    steps,
    before,
    after: advanced.rank,
    passedA: advanced.passedA,
  };
};

export const promotionStepsForPlaces = (
  playerCount: number,
  winnerPlaces: readonly number[],
): PromotionSteps => {
  if (!isSupportedPlayerCount(playerCount)) {
    throw new Error("player count must be one of 4, 6, 8, 10, 12, 14");
  }
  if (
    winnerPlaces.length !== playerCount / 2 ||
    winnerPlaces[0] !== 1 ||
    new Set(winnerPlaces).size !== winnerPlaces.length ||
    winnerPlaces.some(
      (place) => !Number.isInteger(place) || place < 1 || place > playerCount,
    )
  ) {
    throw new Error(
      "winner places must contain the first-place team's complete ranking",
    );
  }

  const key = [...winnerPlaces].sort((left, right) => left - right).join(",");
  if (playerCount === 4) {
    return winnerPlaces[1] === 2 ? 3 : winnerPlaces[1] === 3 ? 2 : 1;
  }
  if (playerCount === 6) {
    if (key === "1,2,3") return 4;
    if (key === "1,2,4") return 3;
    if (key === "1,2,5" || key === "1,3,4") return 2;
    return 1;
  }
  if (playerCount === 8) {
    if (key === "1,2,3,4") return 5;
    if (key === "1,2,3,5") return 4;
    if (key === "1,2,3,6" || key === "1,2,4,5") return 3;
    if (key === "1,2,3,7" || key === "1,2,4,6" || key === "1,3,4,5") {
      return 2;
    }
    return 1;
  }

  const leadingHalf = playerCount / 2;
  const leadingHalfWinners = winnerPlaces.filter(
    (place) => place <= leadingHalf,
  ).length;
  return (
    leadingHalfWinners === leadingHalf ? leadingHalf + 1 : leadingHalfWinners
  ) as PromotionSteps;
};

export const applyPromotion = (
  levels: TeamLevels,
  result: PromotionResult,
): TeamLevels => ({
  ...levels,
  [result.team]: result.after,
});

const isHeartLevel = (card: Card, levelRank: Rank): boolean =>
  card.kind === "suited" && card.suit === "hearts" && card.rank === levelRank;

const tributeStrength = (card: Card, levelRank: Rank): number => {
  if (card.kind === "joker") return card.size === "big" ? 1000 : 900;
  if (card.rank === levelRank) return 800;
  return RANKS.indexOf(card.rank);
};

export const mandatoryTributeCard = (
  hand: readonly DeckCard[],
  levelRank: Rank,
): DeckCard => {
  const eligible = hand.filter(({ card }) => !isHeartLevel(card, levelRank));
  if (eligible.length === 0) throw new Error("no eligible tribute card");
  return [...eligible].sort(
    (a, b) =>
      tributeStrength(b.card, levelRank) - tributeStrength(a.card, levelRank),
  )[0]!;
};

export const canAntiTribute = (hand: readonly DeckCard[]): boolean =>
  hand.filter(({ card }) => card.kind === "joker" && card.size === "big")
    .length >= antiTributeBigJokerRequirement(4);

const bigJokerCount = (hand: readonly DeckCard[]): number =>
  hand.filter(({ card }) => card.kind === "joker" && card.size === "big")
    .length;

export const tributePlanForPlacements = (
  placements: readonly RoundPlacement[],
  hands: readonly (readonly DeckCard[])[],
): TributePlan => {
  if (placements.length !== 4) {
    throw new Error("competitive tribute requires four placements");
  }
  const first = placements[0]!;
  const second = placements[1]!;
  const third = placements[2]!;
  const fourth = placements[3]!;
  const doubleDown = first.team === second.team;
  const payers = doubleDown ? [third.seat, fourth.seat] : [fourth.seat];
  const payerBigJokers = payers.reduce(
    (total, seat) => total + bigJokerCount(hands[seat] ?? []),
    0,
  );
  if (payerBigJokers >= antiTributeBigJokerRequirement(4)) {
    return { kind: "anti-tribute", transfers: [] };
  }
  if (doubleDown) {
    return {
      kind: "double",
      transfers: [
        { fromSeat: fourth.seat, toSeat: first.seat },
        { fromSeat: third.seat, toSeat: second.seat },
      ],
    };
  }
  return {
    kind: "single",
    transfers: [{ fromSeat: fourth.seat, toSeat: first.seat }],
  };
};

export const teamForCompetitiveSeat = (seat: number): Team => teamForSeat(seat);
