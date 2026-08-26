import { RANKS } from "./cards.js";
import type { Card, Rank, Suit } from "./cards.js";

export type HandKind =
  | "single"
  | "pair"
  | "triple"
  | "triple-pair"
  | "straight"
  | "wood-board"
  | "steel-board"
  | "straight-flush"
  | "bomb"
  | "joker-bomb"
  | "invalid";

export interface ClassifiedHand {
  readonly kind: HandKind;
  readonly size: number;
  readonly rank?: Rank;
  readonly suit?: Suit;
}

const rankIndex = (rank: Rank): number => RANKS.indexOf(rank);

const sameRank = (cards: readonly Card[]): Rank | null => {
  if (cards.length === 0 || cards[0]!.kind !== "suited") return null;
  const rank = cards[0]!.rank;
  return cards.every((card) => card.kind === "suited" && card.rank === rank)
    ? rank
    : null;
};

const suitedCards = (
  cards: readonly Card[],
): readonly Extract<Card, { kind: "suited" }>[] | null =>
  cards.every((card) => card.kind === "suited")
    ? (cards as readonly Extract<Card, { kind: "suited" }>[]) 
    : null;

const groupedRanks = (
  cards: readonly Extract<Card, { kind: "suited" }>[],
): Map<Rank, number> => {
  const counts = new Map<Rank, number>();
  for (const card of cards) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  return counts;
};

const straightTopRank = (ranks: readonly Rank[]): Rank | null => {
  if (ranks.length !== 5 || new Set(ranks).size !== 5) return null;
  const sorted = [...ranks].sort((a, b) => rankIndex(a) - rankIndex(b));

  if (sorted.join(",") === "2,3,4,5,A") return "5";

  const start = rankIndex(sorted[0]!);
  for (let index = 1; index < sorted.length; index += 1) {
    if (rankIndex(sorted[index]!) !== start + index) return null;
  }
  return sorted[4]!;
};

const consecutiveGroupTopRank = (
  counts: ReadonlyMap<Rank, number>,
  groupSize: number,
  groupCount: number,
): Rank | null => {
  if (counts.size !== groupCount) return null;
  const entries = [...counts.entries()].sort(
    ([left], [right]) => rankIndex(left) - rankIndex(right),
  );
  if (entries.some(([, count]) => count !== groupSize)) return null;

  const start = rankIndex(entries[0]![0]);
  for (let index = 1; index < entries.length; index += 1) {
    if (rankIndex(entries[index]![0]) !== start + index) return null;
  }
  return entries.at(-1)![0];
};

export const classifyHand = (cards: readonly Card[]): ClassifiedHand => {
  if (cards.length === 0) return { kind: "invalid", size: 0 };

  if (cards.length === 1) {
    const card = cards[0]!;
    return card.kind === "suited"
      ? { kind: "single", size: 1, rank: card.rank }
      : { kind: "single", size: 1 };
  }

  if (cards.length === 4 && cards.every((card) => card.kind === "joker")) {
    return { kind: "joker-bomb", size: 4 };
  }

  const rank = sameRank(cards);
  if (rank !== null) {
    if (cards.length === 2) return { kind: "pair", size: 2, rank };
    if (cards.length === 3) return { kind: "triple", size: 3, rank };
    if (cards.length >= 4) return { kind: "bomb", size: cards.length, rank };
  }

  const suited = suitedCards(cards);
  if (suited === null) return { kind: "invalid", size: cards.length };
  const counts = groupedRanks(suited);

  if (cards.length === 5) {
    const entries = [...counts.entries()];
    if (
      entries.length === 2 &&
      entries.some(([, count]) => count === 3) &&
      entries.some(([, count]) => count === 2)
    ) {
      return {
        kind: "triple-pair",
        size: 5,
        rank: entries.find(([, count]) => count === 3)![0],
      };
    }

    const topRank = straightTopRank(suited.map((card) => card.rank));
    if (topRank !== null) {
      const suit = suited[0]!.suit;
      const sameSuit = suited.every((card) => card.suit === suit);
      return sameSuit
        ? { kind: "straight-flush", size: 5, rank: topRank, suit }
        : { kind: "straight", size: 5, rank: topRank };
    }
  }

  if (cards.length === 6) {
    const steelRank = consecutiveGroupTopRank(counts, 3, 2);
    if (steelRank !== null) {
      return { kind: "steel-board", size: 6, rank: steelRank };
    }

    const woodRank = consecutiveGroupTopRank(counts, 2, 3);
    if (woodRank !== null) {
      return { kind: "wood-board", size: 6, rank: woodRank };
    }
  }

  return { kind: "invalid", size: cards.length };
};

const isBombLike = (hand: ClassifiedHand): boolean =>
  hand.kind === "bomb" ||
  hand.kind === "straight-flush" ||
  hand.kind === "joker-bomb";

const compareBombLike = (
  challenger: ClassifiedHand,
  current: ClassifiedHand,
): boolean => {
  if (challenger.kind === "joker-bomb") return current.kind !== "joker-bomb";
  if (current.kind === "joker-bomb") return false;

  if (challenger.kind === "bomb" && current.kind === "bomb") {
    if (challenger.size !== current.size) return challenger.size > current.size;
    return rankIndex(challenger.rank!) > rankIndex(current.rank!);
  }

  if (challenger.kind === "straight-flush" && current.kind === "straight-flush") {
    return rankIndex(challenger.rank!) > rankIndex(current.rank!);
  }

  if (challenger.kind === "bomb") {
    if (challenger.size >= 6) return true;
    if (challenger.size === 5) return current.kind !== "bomb" || current.size < 5;
    return false;
  }

  if (current.kind === "bomb") {
    if (current.size >= 5) return false;
    return true;
  }

  return false;
};

export const canBeat = (
  challengerCards: readonly Card[],
  currentCards: readonly Card[],
): boolean => {
  const challenger = classifyHand(challengerCards);
  const current = classifyHand(currentCards);
  if (challenger.kind === "invalid" || current.kind === "invalid") return false;

  const challengerBomb = isBombLike(challenger);
  const currentBomb = isBombLike(current);
  if (challengerBomb || currentBomb) {
    if (!challengerBomb) return false;
    if (!currentBomb) return true;
    return compareBombLike(challenger, current);
  }

  if (challenger.kind !== current.kind || challenger.size !== current.size) {
    return false;
  }

  if (challenger.rank === undefined || current.rank === undefined) return false;
  return rankIndex(challenger.rank) > rankIndex(current.rank);
};
