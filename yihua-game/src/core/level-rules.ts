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

const sequenceWindows = (): readonly (readonly Rank[])[] => {
  const windows: Rank[][] = [["A", "2", "3", "4", "5"]];
  for (let start = 0; start + 5 <= RANKS.length; start += 1) {
    windows.push(RANKS.slice(start, start + 5) as Rank[]);
  }
  return windows;
};

const SEQUENCE_WINDOWS = sequenceWindows();

const rankCounts = (
  cards: readonly Extract<Card, { kind: "suited" }>[],
): Map<Rank, number> => {
  const counts = new Map<Rank, number>();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  return counts;
};

const materializeTargets = (
  fixed: readonly Extract<Card, { kind: "suited" }>[],
  wildcardCount: number,
  targets: readonly { readonly rank: Rank; readonly suit?: Suit }[],
): readonly Card[] => {
  const remaining = [...targets];
  for (const card of fixed) {
    const index = remaining.findIndex(
      (target) =>
        target.rank === card.rank &&
        (target.suit === undefined || target.suit === card.suit),
    );
    if (index >= 0) remaining.splice(index, 1);
  }

  const replacements = remaining.slice(0, wildcardCount).map((target) => ({
    kind: "suited" as const,
    rank: target.rank,
    suit: target.suit ?? ("clubs" as const),
  }));
  return [...fixed, ...replacements];
};

const addInterpretation = (
  output: Map<string, WildcardInterpretation>,
  hand: ClassifiedHand,
  fixed: readonly Extract<Card, { kind: "suited" }>[],
  wildcardCount: number,
  targets: readonly { readonly rank: Rank; readonly suit?: Suit }[],
): void => {
  const key = `${hand.kind}:${hand.size}:${hand.rank ?? ""}:${hand.suit ?? ""}`;
  if (output.has(key)) return;
  output.set(key, {
    hand,
    substitutedCards: materializeTargets(fixed, wildcardCount, targets),
    wildcardCount,
  });
};

const matchesTargetCounts = (
  fixedCounts: ReadonlyMap<Rank, number>,
  targetCounts: ReadonlyMap<Rank, number>,
  wildcardCount: number,
): boolean => {
  let missing = 0;
  for (const [rank, count] of fixedCounts) {
    const target = targetCounts.get(rank);
    if (target === undefined || count > target) return false;
  }
  for (const [rank, target] of targetCounts) {
    missing += target - (fixedCounts.get(rank) ?? 0);
  }
  return missing === wildcardCount;
};

const targetsFromCounts = (
  counts: ReadonlyMap<Rank, number>,
  suit?: Suit,
): readonly { readonly rank: Rank; readonly suit?: Suit }[] => {
  const targets: { rank: Rank; suit?: Suit }[] = [];
  for (const [rank, count] of counts) {
    for (let index = 0; index < count; index += 1) {
      targets.push(suit === undefined ? { rank } : { rank, suit });
    }
  }
  return targets;
};

export const enumerateWildcardInterpretations = (
  cards: readonly Card[],
  rules: LevelRules,
): readonly WildcardInterpretation[] => {
  if (cards.length === 0) return [];

  const wildcards = cards.filter((card) => isHeartLevelWildcard(card, rules));
  if (wildcards.length === 0 || cards.length === 1) {
    const hand = classifyHand(cards);
    return hand.kind === "invalid"
      ? []
      : [{ hand, substitutedCards: [...cards], wildcardCount: 0 }];
  }

  const fixedCards = cards.filter((card) => !isHeartLevelWildcard(card, rules));
  if (fixedCards.some((card) => card.kind === "joker")) return [];

  const fixed = fixedCards as readonly Extract<Card, { kind: "suited" }>[];
  const wildcardCount = wildcards.length;
  const fixedCounts = rankCounts(fixed);
  const output = new Map<string, WildcardInterpretation>();

  if (cards.length === 2 || cards.length === 3 || cards.length >= 4) {
    const kind: HandKind =
      cards.length === 2 ? "pair" : cards.length === 3 ? "triple" : "bomb";
    for (const rank of RANKS) {
      const targets = new Map<Rank, number>([[rank, cards.length]]);
      if (!matchesTargetCounts(fixedCounts, targets, wildcardCount)) continue;
      addInterpretation(
        output,
        { kind, size: cards.length, rank },
        fixed,
        wildcardCount,
        targetsFromCounts(targets),
      );
    }
  }

  if (cards.length === 5) {
    for (const tripleRank of RANKS) {
      for (const pairRank of RANKS) {
        if (tripleRank === pairRank) continue;
        const targets = new Map<Rank, number>([
          [tripleRank, 3],
          [pairRank, 2],
        ]);
        if (!matchesTargetCounts(fixedCounts, targets, wildcardCount)) continue;
        addInterpretation(
          output,
          { kind: "triple-pair", size: 5, rank: tripleRank },
          fixed,
          wildcardCount,
          targetsFromCounts(targets),
        );
      }
    }

    for (const window of SEQUENCE_WINDOWS) {
      const targets = new Map<Rank, number>(window.map((rank) => [rank, 1]));
      if (!matchesTargetCounts(fixedCounts, targets, wildcardCount)) continue;
      const topRank = window[0] === "A" ? "5" : window[4]!;
      addInterpretation(
        output,
        { kind: "straight", size: 5, rank: topRank },
        fixed,
        wildcardCount,
        targetsFromCounts(targets),
      );

      for (const suit of SUITS) {
        if (fixed.some((card) => card.suit !== suit)) continue;
        addInterpretation(
          output,
          { kind: "straight-flush", size: 5, rank: topRank, suit },
          fixed,
          wildcardCount,
          targetsFromCounts(targets, suit),
        );
      }
    }
  }

  if (cards.length === 6) {
    for (let start = 0; start + 3 <= RANKS.length; start += 1) {
      const ranks = RANKS.slice(start, start + 3);
      const targets = new Map<Rank, number>(ranks.map((rank) => [rank, 2]));
      if (!matchesTargetCounts(fixedCounts, targets, wildcardCount)) continue;
      addInterpretation(
        output,
        { kind: "wood-board", size: 6, rank: ranks[2]! },
        fixed,
        wildcardCount,
        targetsFromCounts(targets),
      );
    }

    for (let start = 0; start + 2 <= RANKS.length; start += 1) {
      const ranks = RANKS.slice(start, start + 2);
      const targets = new Map<Rank, number>(ranks.map((rank) => [rank, 3]));
      if (!matchesTargetCounts(fixedCounts, targets, wildcardCount)) continue;
      addInterpretation(
        output,
        { kind: "steel-board", size: 6, rank: ranks[1]! },
        fixed,
        wildcardCount,
        targetsFromCounts(targets),
      );
    }
  }

  return [...output.values()];
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
      if (challenger.size !== current.size)
        return challenger.size > current.size;
    }

    if (challenger.rank === undefined || current.rank === undefined)
      return false;
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
