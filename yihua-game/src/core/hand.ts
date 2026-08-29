import { RANKS, type Card, type Rank } from "./cards.js";

export type HandKind =
  | "single"
  | "pair"
  | "triple"
  | "full-house"
  | "straight"
  | "straight-flush"
  | "consecutive-pairs"
  | "consecutive-triples"
  | "bomb"
  | "joker-bomb"
  | "invalid";

export interface ClassifiedHand {
  readonly kind: HandKind;
  readonly size: number;
  readonly rank?: Rank;
  readonly highRank?: Rank;
  readonly jokerSize?: "small" | "big";
}

const suitedCards = (cards: readonly Card[]) =>
  cards.filter((card) => card.kind === "suited");

const sameSuitedRank = (cards: readonly Card[]): Rank | null => {
  if (cards.length === 0 || cards[0]!.kind !== "suited") return null;
  const rank = cards[0]!.rank;
  return cards.every((card) => card.kind === "suited" && card.rank === rank)
    ? rank
    : null;
};

const rankCounts = (cards: readonly Card[]): Map<Rank, number> => {
  const counts = new Map<Rank, number>();
  for (const card of cards) {
    if (card.kind !== "suited") continue;
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  return counts;
};

const rankIndex = (rank: Rank): number => RANKS.indexOf(rank);

const consecutiveHighRank = (ranks: readonly Rank[]): Rank | null => {
  const unique = [...new Set(ranks)].sort(
    (a, b) => rankIndex(a) - rankIndex(b),
  );
  if (unique.length !== ranks.length) return null;

  if (
    unique.length === 5 &&
    unique.includes("A") &&
    unique.includes("2") &&
    unique.includes("3") &&
    unique.includes("4") &&
    unique.includes("5")
  ) {
    return "5";
  }

  if (unique.includes("2")) return null;

  const indexes = unique.map(rankIndex);
  const consecutive = indexes.every(
    (value, index) => index === 0 || value === indexes[index - 1]! + 1,
  );
  return consecutive ? unique.at(-1)! : null;
};

const repeatedSequenceHighRank = (
  counts: ReadonlyMap<Rank, number>,
  repeat: number,
  groups: number,
): Rank | null => {
  if (counts.size !== groups) return null;
  const ranks = [...counts.keys()];
  if (ranks.some((rank) => counts.get(rank) !== repeat)) return null;
  return consecutiveHighRank(ranks);
};

export const classifyHand = (cards: readonly Card[]): ClassifiedHand => {
  if (cards.length === 0) return { kind: "invalid", size: 0 };

  if (cards.length === 1) {
    const card = cards[0]!;
    return card.kind === "suited"
      ? { kind: "single", size: 1, rank: card.rank }
      : { kind: "single", size: 1, jokerSize: card.size };
  }

  if (
    cards.length === 2 &&
    cards.every(
      (card) => card.kind === "joker" && card.size === cards[0]!.size,
    )
  ) {
    return {
      kind: "pair",
      size: 2,
      jokerSize: (cards[0] as Extract<Card, { kind: "joker" }>).size,
    };
  }

  if (cards.length === 4 && cards.every((card) => card.kind === "joker")) {
    return { kind: "joker-bomb", size: 4 };
  }

  if (suitedCards(cards).length !== cards.length) {
    return { kind: "invalid", size: cards.length };
  }

  const rank = sameSuitedRank(cards);
  if (rank !== null) {
    if (cards.length === 2) return { kind: "pair", size: 2, rank };
    if (cards.length === 3) return { kind: "triple", size: 3, rank };
    if (cards.length >= 4) return { kind: "bomb", size: cards.length, rank };
  }

  const counts = rankCounts(cards);

  if (cards.length === 5) {
    const groups = [...counts.entries()].map(([, count]) => count).sort();
    if (groups.length === 2 && groups[0] === 2 && groups[1] === 3) {
      const tripleRank = [...counts.entries()].find(
        ([, count]) => count === 3,
      )![0];
      return { kind: "full-house", size: 5, rank: tripleRank };
    }

    const ranks = cards.map(
      (card) => (card as Extract<Card, { kind: "suited" }>).rank,
    );
    const highRank = consecutiveHighRank(ranks);
    if (highRank !== null) {
      const suits = new Set(
        cards.map((card) => (card as Extract<Card, { kind: "suited" }>).suit),
      );
      return {
        kind: suits.size === 1 ? "straight-flush" : "straight",
        size: 5,
        highRank,
      };
    }
  }

  if (cards.length === 6) {
    const pairHigh = repeatedSequenceHighRank(counts, 2, 3);
    if (pairHigh !== null) {
      return { kind: "consecutive-pairs", size: 6, highRank: pairHigh };
    }

    const tripleHigh = repeatedSequenceHighRank(counts, 3, 2);
    if (tripleHigh !== null) {
      return { kind: "consecutive-triples", size: 6, highRank: tripleHigh };
    }
  }

  return { kind: "invalid", size: cards.length };
};

const normalStrength = (hand: ClassifiedHand): number | null => {
  if (hand.jokerSize !== undefined) {
    return RANKS.length + (hand.jokerSize === "big" ? 1 : 0);
  }
  const rank = hand.rank ?? hand.highRank;
  return rank === undefined ? null : rankIndex(rank);
};

const bombStrength = (hand: ClassifiedHand): number | null => {
  if (hand.kind === "joker-bomb") return 10000;
  if (hand.kind === "straight-flush") {
    return 7000 + (normalStrength(hand) ?? 0);
  }
  if (hand.kind !== "bomb") return null;

  const rank = normalStrength(hand) ?? 0;
  if (hand.size >= 6) return 8000 + hand.size * 100 + rank;
  if (hand.size === 5) return 6000 + rank;
  return 5000 + rank;
};

export const canHandBeat = (
  candidate: ClassifiedHand,
  current: ClassifiedHand,
): boolean => {
  if (candidate.kind === "invalid" || current.kind === "invalid") return false;

  const candidateBomb = bombStrength(candidate);
  const currentBomb = bombStrength(current);
  if (candidateBomb !== null || currentBomb !== null) {
    if (candidateBomb === null) return false;
    if (currentBomb === null) return true;
    return candidateBomb > currentBomb;
  }

  if (candidate.kind !== current.kind || candidate.size !== current.size) {
    return false;
  }

  const candidateStrength = normalStrength(candidate);
  const currentStrength = normalStrength(current);
  return (
    candidateStrength !== null &&
    currentStrength !== null &&
    candidateStrength > currentStrength
  );
};
