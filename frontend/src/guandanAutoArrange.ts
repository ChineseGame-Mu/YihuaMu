import type { GuandanCard, GuandanRank } from "./guandanProtocol";

export interface GuandanHandEntry {
  readonly card: GuandanCard;
  readonly originalIndex: number;
}

const ranks: GuandanRank[] = [
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Jack",
  "Queen",
  "King",
  "Ace",
];

const suits = ["Clubs", "Diamonds", "Spades", "Hearts"] as const;
const suitOrder: Record<string, number> = {
  Clubs: 0,
  Diamonds: 1,
  Spades: 2,
  Hearts: 3,
};

const straightWindows: GuandanRank[][] = [
  ["Ace", "Two", "Three", "Four", "Five"],
  ...Array.from({ length: 9 }, (_, index) => ranks.slice(index, index + 5)),
];

const sequenceWindows = (size: number): GuandanRank[][] =>
  Array.from({ length: ranks.length - size + 1 }, (_, index) =>
    ranks.slice(index, index + size),
  );

const rankOf = (entry: GuandanHandEntry): GuandanRank | null =>
  "Suited" in entry.card ? entry.card.Suited.rank : null;

const suitOf = (entry: GuandanHandEntry): string | null =>
  "Suited" in entry.card ? entry.card.Suited.suit : null;

const rankValue = (rank: GuandanRank): number => ranks.indexOf(rank);

const entryValue = (entry: GuandanHandEntry): number => {
  if ("Joker" in entry.card) {
    return entry.card.Joker === "Small" ? 1_000 : 1_100;
  }
  return (
    rankValue(entry.card.Suited.rank) * 10 + suitOrder[entry.card.Suited.suit]!
  );
};

/**
 * Groups a hand without changing card identities or play indexes. Wildcards
 * remain untouched: automatic arranging never silently assigns a wildcard a
 * role that the player did not choose.
 */
export const autoArrangeGuandanHand = (
  hand: readonly GuandanHandEntry[],
  direction: "asc" | "desc",
): GuandanHandEntry[] => {
  const remaining = new Set(hand.map(({ originalIndex }) => originalIndex));
  const groups: GuandanHandEntry[][] = [];
  const orderedWindows = <T>(windows: readonly T[]): T[] =>
    direction === "asc" ? [...windows] : [...windows].reverse();

  const available = (): GuandanHandEntry[] =>
    hand.filter(({ originalIndex }) => remaining.has(originalIndex));
  const take = (entries: readonly GuandanHandEntry[]): void => {
    if (entries.length === 0) return;
    entries.forEach(({ originalIndex }) => remaining.delete(originalIndex));
    groups.push([...entries]);
  };
  const rankCards = (rank: GuandanRank): GuandanHandEntry[] =>
    available().filter((entry) => rankOf(entry) === rank);

  // Straight flushes first, because their suit relationship would otherwise
  // be lost when equal ranks are stacked together.
  for (const window of orderedWindows(straightWindows)) {
    for (const suit of suits) {
      const cards = window.map((rank) =>
        available().find(
          (entry) => rankOf(entry) === rank && suitOf(entry) === suit,
        ),
      );
      if (cards.every((entry) => entry !== undefined)) {
        take(cards as GuandanHandEntry[]);
      }
    }
  }

  // Natural bombs keep every same-rank card together.
  for (const rank of orderedWindows(ranks)) {
    const cards = rankCards(rank);
    if (cards.length >= 4) take(cards);
  }

  // Steel plates: two consecutive triples.
  for (const window of orderedWindows(sequenceWindows(2))) {
    const cards = window.flatMap((rank) => rankCards(rank).slice(0, 3));
    if (cards.length === 6) take(cards);
  }

  // Consecutive pairs (wooden plate): three consecutive pairs.
  for (const window of orderedWindows(sequenceWindows(3))) {
    const cards = window.flatMap((rank) => rankCards(rank).slice(0, 2));
    if (cards.length === 6) take(cards);
  }

  // Three-with-two combinations.
  for (const tripleRank of orderedWindows(ranks)) {
    const triple = rankCards(tripleRank).slice(0, 3);
    if (triple.length !== 3) continue;
    const pairRank = orderedWindows(ranks).find(
      (rank) => rank !== tripleRank && rankCards(rank).length >= 2,
    );
    if (pairRank !== undefined) {
      take([...triple, ...rankCards(pairRank).slice(0, 2)]);
    }
  }

  // Five-card straights, including A2345 as the smallest straight.
  for (const window of orderedWindows(straightWindows)) {
    const cards = window.map((rank) => rankCards(rank)[0]);
    if (cards.every((entry) => entry !== undefined)) {
      take(cards as GuandanHandEntry[]);
    }
  }

  // Keep remaining triples, pairs and singles visibly grouped.
  for (const size of [3, 2, 1]) {
    for (const rank of orderedWindows(ranks)) {
      while (rankCards(rank).length >= size) {
        take(rankCards(rank).slice(0, size));
      }
    }
  }

  const jokers = available().sort((a, b) => entryValue(a) - entryValue(b));
  if (direction === "desc") jokers.reverse();
  jokers.forEach((entry) => take([entry]));

  return groups.flat();
};
