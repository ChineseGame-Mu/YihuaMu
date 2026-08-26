import { RANKS, SUITS } from "./cards.js";
import type { Card, Rank, Suit } from "./cards.js";
import { classifyHand } from "./hand.js";
import type { ClassifiedHand, HandKind } from "./hand.js";

export interface LevelRules {
  readonly levelRank: Rank;
}

export interface WildcardInterpretation {
  readonly hand: ClassifiedHand;
  readonly substitutedCards: readonly Card[];
  readonly wildcardCount: number;
}

export const isHeartLevelWildcard = (card: Card, rules: LevelRules): boolean =>
  card.kind === "suited" &&
  card.suit === "hearts" &&
  card.rank === rules.levelRank;

const ordinaryRankStrength = (rank: Rank, levelRank: Rank): number => {
  if (rank === levelRank) return RANKS.length;
  const levelIndex = RANKS.indexOf(levelRank);
  const rankIndex = RANKS.indexOf(rank);
  return rankIndex < levelIndex ? rankIndex : rankIndex - 1;
};

export const compareOrdinaryRanks = (
  challenger: Rank,
  current: Rank,
  rules: LevelRules,
): number =>
  ordinaryRankStrength(challenger, rules.levelRank) -
  ordinaryRankStrength(current, rules.levelRank);

const replacementCards = (): readonly Extract<Card, { kind: "suited" }>[] =>
  RANKS.flatMap((rank) =>
    SUITS.map((suit) => ({ kind: "suited" as const, rank, suit })),
  );

const REPLACEMENTS = replacementCards();

const interpretationKey = (interpretation: WildcardInterpretation): string => {
  const { hand } = interpretation;
  return `${hand.kind}:${hand.size}:${hand.rank ?? ""}:${hand.suit ?? ""}`;
};

const enumerateAssignments = (
  cards: readonly Card[],
  wildcardIndexes: readonly number[],
  index: number,
  working: Card[],
  output: WildcardInterpretation[],
): void => {
  if (index === wildcardIndexes.length) {
    const hand = classifyHand(working);
    if (hand.kind !== "invalid") {
      output.push({
        hand,
        substitutedCards: [...working],
        wildcardCount: wildcardIndexes.length,
      });
    }
    return;
  }

  const cardIndex = wildcardIndexes[index]!;
  for (const replacement of REPLACEMENTS) {
    working[cardIndex] = replacement;
    enumerateAssignments(cards, wildcardIndexes, index + 1, working, output);
  }
  working[cardIndex] = cards[cardIndex]!;
};

export const enumerateWildcardInterpretations = (
  cards: readonly Card[],
  rules: LevelRules,
): readonly WildcardInterpretation[] => {
  if (cards.length === 0) return [];

  const wildcardIndexes = cards
    .map((card, index) => (isHeartLevelWildcard(card, rules) ? index : -1))
    .filter((index) => index >= 0);

  if (wildcardIndexes.length === 0 || cards.length === 1) {
    const hand = classifyHand(cards);
    return hand.kind === "invalid"
      ? []
      : [{ hand, substitutedCards: [...cards], wildcardCount: 0 }];
  }

  const interpretations: WildcardInterpretation[] = [];
  enumerateAssignments(cards, wildcardIndexes, 0, [...cards], interpretations);

  const unique = new Map<string, WildcardInterpretation>();
  for (const interpretation of interpretations) {
    const key = interpretationKey(interpretation);
    if (!unique.has(key)) unique.set(key, interpretation);
  }
  return [...unique.values()];
};

export const resolveWildcardInterpretation = (
  cards: readonly Card[],
  rules: LevelRules,
  declaredKind?: HandKind,
): WildcardInterpretation => {
  const interpretations = enumerateWildcardInterpretations(cards, rules);
  const candidates = declaredKind
    ? interpretations.filter(({ hand }) => hand.kind === declaredKind)
    : interpretations;

  if (candidates.length === 0) {
    throw new Error("cards do not form the declared hand");
  }

  const distinctKinds = new Set(candidates.map(({ hand }) => hand.kind));
  if (declaredKind === undefined && distinctKinds.size > 1) {
    throw new Error("ambiguous wildcard hand requires a declared kind");
  }

  return candidates.reduce((best, candidate) => {
    if (best.hand.rank === undefined) return candidate;
    if (candidate.hand.rank === undefined) return best;
    return compareOrdinaryRanks(candidate.hand.rank, best.hand.rank, rules) > 0
      ? candidate
      : best;
  });
};

const isBombLike = (hand: ClassifiedHand): boolean =>
  hand.kind === "bomb" ||
  hand.kind === "straight-flush" ||
  hand.kind === "joker-bomb";

const bombTier = (hand: ClassifiedHand): number => {
  if (hand.kind === "joker-bomb") return 100;
  if (hand.kind === "bomb") {
    if (hand.size >= 6) return 60 + hand.size;
    if (hand.size === 5) return 40;
    if (hand.size === 4) return 30;
  }
  if (hand.kind === "straight-flush") return 50;
  return 0;
};

export const canClassifiedBeatWithLevelRules = (
  challenger: ClassifiedHand,
  current: ClassifiedHand,
  rules: LevelRules,
): boolean => {
  const challengerBomb = isBombLike(challenger);
  const currentBomb = isBombLike(current);

  if (challengerBomb || currentBomb) {
    if (!challengerBomb) return false;
    if (!currentBomb) return true;

    const challengerTier = bombTier(challenger);
    const currentTier = bombTier(current);
    if (challengerTier !== currentTier) return challengerTier > currentTier;

    if (challenger.kind === "bomb" && current.kind === "bomb") {
      if (challenger.size !== current.size) return challenger.size > current.size;
    }

    if (challenger.rank === undefined || current.rank === undefined) return false;
    return compareOrdinaryRanks(challenger.rank, current.rank, rules) > 0;
  }

  if (challenger.kind !== current.kind || challenger.size !== current.size) {
    return false;
  }
  if (challenger.rank === undefined || current.rank === undefined) return false;
  return compareOrdinaryRanks(challenger.rank, current.rank, rules) > 0;
};

export const canBeatWithLevelRules = (
  challengerCards: readonly Card[],
  currentCards: readonly Card[],
  rules: LevelRules,
): boolean => {
  const challengers = enumerateWildcardInterpretations(challengerCards, rules);
  const currents = enumerateWildcardInterpretations(currentCards, rules);
  if (challengers.length === 0 || currents.length === 0) return false;

  return challengers.some((challenger) =>
    currents.some((current) =>
      canClassifiedBeatWithLevelRules(challenger.hand, current.hand, rules),
    ),
  );
};

export const classifyWithLevelRules = (
  cards: readonly Card[],
  rules: LevelRules,
): readonly ClassifiedHand[] =>
  enumerateWildcardInterpretations(cards, rules).map(
    (interpretation) => interpretation.hand,
  );
