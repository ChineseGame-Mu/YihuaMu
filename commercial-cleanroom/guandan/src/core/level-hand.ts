import { RANKS, type Card, type Rank, type Suit } from "./cards.js";
import { classifyHand, type ClassifiedHand } from "./hand.js";

const suited = (card: Card): card is Extract<Card, { kind: "suited" }> =>
  card.kind === "suited";

const isLevelWildcard = (card: Card, levelRank: Rank): boolean =>
  card.kind === "suited" && card.suit === "hearts" && card.rank === levelRank;

const rankIndex = (rank: Rank): number => RANKS.indexOf(rank);

const sequenceCandidates = (length: number): readonly Rank[][] => {
  const regular = RANKS.filter((rank) => rank !== "2");
  const result: Rank[][] = [];
  for (let start = 0; start + length <= regular.length; start += 1) {
    result.push(regular.slice(start, start + length));
  }
  if (length === 5) {
    result.push(["A", "2", "3", "4", "5"]);
    result.push(["2", "3", "4", "5", "6"]);
  }
  return result;
};

const missingForRankTargets = (
  cards: readonly Extract<Card, { kind: "suited" }>[],
  targets: ReadonlyMap<Rank, number>,
): number | null => {
  const used = new Map<Rank, number>();
  for (const card of cards) {
    if (!targets.has(card.rank)) return null;
    const next = (used.get(card.rank) ?? 0) + 1;
    if (next > targets.get(card.rank)!) return null;
    used.set(card.rank, next);
  }

  let missing = 0;
  for (const [rank, count] of targets) {
    missing += count - (used.get(rank) ?? 0);
  }
  return missing;
};

const classifySameRank = (
  fixed: readonly Extract<Card, { kind: "suited" }>[],
  wildcardCount: number,
  size: number,
): ClassifiedHand | null => {
  if (size < 2 || fixed.length === 0) return null;
  const rank = fixed[0]!.rank;
  if (!fixed.every((card) => card.rank === rank)) return null;
  if (fixed.length + wildcardCount !== size) return null;
  if (size === 2) return { kind: "pair", size, rank };
  if (size === 3) return { kind: "triple", size, rank };
  return { kind: "bomb", size, rank };
};

const classifyFullHouse = (
  fixed: readonly Extract<Card, { kind: "suited" }>[],
  wildcardCount: number,
): ClassifiedHand | null => {
  let best: Rank | null = null;
  for (const tripleRank of RANKS) {
    for (const pairRank of RANKS) {
      if (tripleRank === pairRank) continue;
      const missing = missingForRankTargets(
        fixed,
        new Map<Rank, number>([
          [tripleRank, 3],
          [pairRank, 2],
        ]),
      );
      if (missing !== wildcardCount) continue;
      if (best === null || rankIndex(tripleRank) > rankIndex(best)) {
        best = tripleRank;
      }
    }
  }
  return best === null ? null : { kind: "full-house", size: 5, rank: best };
};

const classifySequence = (
  fixed: readonly Extract<Card, { kind: "suited" }>[],
  wildcardCount: number,
  flush: boolean,
): ClassifiedHand | null => {
  if (flush && fixed.length > 0) {
    const suit: Suit = fixed[0]!.suit;
    if (!fixed.every((card) => card.suit === suit)) return null;
  }

  let best: Rank | null = null;
  for (const candidate of sequenceCandidates(5)) {
    const missing = missingForRankTargets(
      fixed,
      new Map(candidate.map((rank) => [rank, 1] as const)),
    );
    if (missing !== wildcardCount) continue;
    const highRank =
      candidate.includes("A") && candidate.includes("2")
        ? "5"
        : candidate.at(-1)!;
    if (best === null || rankIndex(highRank) > rankIndex(best)) best = highRank;
  }

  if (best === null) return null;
  return {
    kind: flush ? "straight-flush" : "straight",
    size: 5,
    highRank: best,
  };
};

const classifyRepeatedSequence = (
  fixed: readonly Extract<Card, { kind: "suited" }>[],
  wildcardCount: number,
  repeat: 2 | 3,
  groups: 2 | 3,
): ClassifiedHand | null => {
  let best: Rank | null = null;
  for (const candidate of sequenceCandidates(groups)) {
    const missing = missingForRankTargets(
      fixed,
      new Map(candidate.map((rank) => [rank, repeat] as const)),
    );
    if (missing !== wildcardCount) continue;
    const highRank = candidate.at(-1)!;
    if (best === null || rankIndex(highRank) > rankIndex(best)) best = highRank;
  }
  if (best === null) return null;
  return {
    kind: repeat === 2 ? "consecutive-pairs" : "consecutive-triples",
    size: repeat * groups,
    highRank: best,
  };
};

export const classifyHandWithLevel = (
  cards: readonly Card[],
  levelRank: Rank,
): ClassifiedHand => {
  const natural = classifyHand(cards);
  if (cards.some((card) => card.kind === "joker")) return natural;

  const wildcardCount = cards.filter((card) =>
    isLevelWildcard(card, levelRank),
  ).length;
  if (wildcardCount === 0) return natural;
  const fixed = cards.filter(
    (card): card is Extract<Card, { kind: "suited" }> =>
      suited(card) && !isLevelWildcard(card, levelRank),
  );

  if (cards.length === 5) {
    const straightFlush = classifySequence(fixed, wildcardCount, true);
    if (straightFlush !== null) return straightFlush;

    const fullHouse = classifyFullHouse(fixed, wildcardCount);
    if (fullHouse !== null) {
      if (natural.kind !== "full-house") return fullHouse;
      const naturalRank = natural.rank;
      const fullHouseRank = fullHouse.rank;
      if (
        naturalRank === undefined ||
        (fullHouseRank !== undefined &&
          rankIndex(fullHouseRank) > rankIndex(naturalRank))
      ) {
        return fullHouse;
      }
    }
  }

  if (natural.kind !== "invalid") return natural;

  const sameRank = classifySameRank(fixed, wildcardCount, cards.length);
  if (sameRank !== null) return sameRank;

  if (cards.length === 5) {
    const fullHouse = classifyFullHouse(fixed, wildcardCount);
    if (fullHouse !== null) return fullHouse;
    const straight = classifySequence(fixed, wildcardCount, false);
    if (straight !== null) return straight;
  }

  if (cards.length === 6) {
    const triples = classifyRepeatedSequence(fixed, wildcardCount, 3, 2);
    if (triples !== null) return triples;
    const pairs = classifyRepeatedSequence(fixed, wildcardCount, 2, 3);
    if (pairs !== null) return pairs;
  }

  return natural;
};
