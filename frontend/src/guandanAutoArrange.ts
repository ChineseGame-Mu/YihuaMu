import type { GuandanCard, GuandanRank, GuandanSuit } from "./guandanProtocol";

export type GuandanAutoGroupKind =
  | "joker-bomb"
  | "bomb"
  | "straight-flush"
  | "consecutive-triples"
  | "consecutive-pairs"
  | "straight"
  | "full-house"
  | "triple"
  | "pair"
  | "custom"
  | "single";

export interface GuandanAutoGroup {
  kind: GuandanAutoGroupKind;
  label: string;
  indexes: number[];
}

export type GuandanArrangeStrategy = "balanced" | "sequences" | "sets";

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

const suits: GuandanSuit[] = ["Clubs", "Diamonds", "Spades", "Hearts"];

const rankLabels: Record<GuandanRank, string> = {
  Two: "2",
  Three: "3",
  Four: "4",
  Five: "5",
  Six: "6",
  Seven: "7",
  Eight: "8",
  Nine: "9",
  Ten: "10",
  Jack: "J",
  Queen: "Q",
  King: "K",
  Ace: "A",
};

const rankOf = (card: GuandanCard): GuandanRank | null =>
  "Suited" in card ? card.Suited.rank : null;

const isWildcard = (card: GuandanCard, level: GuandanRank): boolean =>
  "Suited" in card &&
  card.Suited.suit === "Hearts" &&
  card.Suited.rank === level;

const straightWindows = (): GuandanRank[][] => {
  const windows: GuandanRank[][] = [["Ace", "Two", "Three", "Four", "Five"]];
  for (let start = 0; start <= 8; start += 1) {
    windows.push(ranks.slice(start, start + 5));
  }
  return windows;
};

const highLabel = (window: GuandanRank[]): string => {
  const aceLow =
    window[0] === "Ace" &&
    window[1] === "Two" &&
    window[window.length - 1] === "Five";
  return rankLabels[aceLow ? "Five" : window[window.length - 1]];
};

type Target = { rank: GuandanRank; count: number };

/**
 * Partition a private hand for display only. It never changes card identity,
 * server order, selection indexes, or the rules used to validate a play.
 */
export const arrangeGuandanHand = (
  hand: GuandanCard[],
  level: GuandanRank | null,
  strategy: GuandanArrangeStrategy = "balanced",
): GuandanAutoGroup[] => {
  if (level === null) {
    return hand.map((_, index) => ({
      kind: "single",
      label: "单张",
      indexes: [index],
    }));
  }

  const remaining = new Set(hand.map((_, index) => index));
  const groups: GuandanAutoGroup[] = [];
  const availableWildcards = (): number[] =>
    Array.from(remaining).filter((index) => isWildcard(hand[index], level));

  const addGroup = (
    kind: GuandanAutoGroupKind,
    label: string,
    indexes: number[],
  ): void => {
    indexes.forEach((index) => remaining.delete(index));
    groups.push({ kind, label, indexes });
  };

  const findTarget = (
    targets: Target[],
    suit?: GuandanSuit,
  ): number[] | null => {
    const selected: number[] = [];
    let wildcardsNeeded = 0;
    for (const target of targets) {
      const matching = Array.from(remaining).filter((index) => {
        const card = hand[index];
        return (
          !isWildcard(card, level) &&
          "Suited" in card &&
          card.Suited.rank === target.rank &&
          (suit === undefined || card.Suited.suit === suit)
        );
      });
      selected.push(...matching.slice(0, target.count));
      wildcardsNeeded += Math.max(0, target.count - matching.length);
    }
    const wildcards = availableWildcards();
    if (wildcards.length < wildcardsNeeded) return null;
    return selected.concat(wildcards.slice(0, wildcardsNeeded));
  };

  // Protect the complete four-joker bomb before forming any other group.
  const jokerIndexes = Array.from(remaining).filter(
    (index) => "Joker" in hand[index],
  );
  const smallJokers = jokerIndexes.filter(
    (index) => "Joker" in hand[index] && hand[index].Joker === "Small",
  );
  const bigJokers = jokerIndexes.filter(
    (index) => "Joker" in hand[index] && hand[index].Joker === "Big",
  );
  if (smallJokers.length >= 2 && bigJokers.length >= 2) {
    addGroup(
      "joker-bomb",
      "四王炸",
      smallJokers.slice(0, 2).concat(bigJokers.slice(0, 2)),
    );
  }

  // Natural bombs are never split to manufacture a lower ordinary pattern.
  ranks.forEach((rank) => {
    const indexes = Array.from(remaining).filter(
      (index) =>
        !isWildcard(hand[index], level) && rankOf(hand[index]) === rank,
    );
    if (indexes.length >= 4) {
      addGroup("bomb", `${indexes.length}张${rankLabels[rank]}炸`, indexes);
    }
  });

  // Heart-level wildcards can complete or enlarge a protected bomb.
  ranks.forEach((rank) => {
    const indexes = Array.from(remaining).filter(
      (index) =>
        !isWildcard(hand[index], level) && rankOf(hand[index]) === rank,
    );
    const wildcards = availableWildcards();
    if (indexes.length >= 2 && indexes.length + wildcards.length >= 4) {
      const bombIndexes = indexes.concat(wildcards);
      addGroup(
        "bomb",
        `${bombIndexes.length}张${rankLabels[rank]}炸`,
        bombIndexes,
      );
    }
  });

  const takeRepeatedly = (
    kind: GuandanAutoGroupKind,
    candidates: () => Array<{ indexes: number[] | null; label: string }>,
  ): void => {
    while (true) {
      const match = candidates().find(
        (candidate) => candidate.indexes !== null,
      );
      if (match?.indexes === null || match?.indexes === undefined) return;
      addGroup(kind, match.label, match.indexes);
    }
  };

  const takeStraightFlushes = (): void =>
    takeRepeatedly("straight-flush", () =>
      suits.flatMap((suit) =>
        straightWindows().map((window) => ({
          indexes: findTarget(
            window.map((rank) => ({ rank, count: 1 })),
            suit,
          ),
          label: `同花顺（到${highLabel(window)}）`,
        })),
      ),
    );

  const takeConsecutiveTriples = (): void =>
    takeRepeatedly("consecutive-triples", () =>
      ranks.slice(0, -1).map((rank, start) => ({
        indexes: findTarget([
          { rank, count: 3 },
          { rank: ranks[start + 1], count: 3 },
        ]),
        label: `钢板（${rankLabels[rank]}-${rankLabels[ranks[start + 1]]}）`,
      })),
    );

  const takeConsecutivePairs = (): void =>
    takeRepeatedly("consecutive-pairs", () =>
      ranks.slice(0, -2).map((rank, start) => ({
        indexes: findTarget([
          { rank, count: 2 },
          { rank: ranks[start + 1], count: 2 },
          { rank: ranks[start + 2], count: 2 },
        ]),
        label: `三连对（到${rankLabels[ranks[start + 2]]}）`,
      })),
    );

  const takeStraights = (): void =>
    takeRepeatedly("straight", () =>
      straightWindows().map((window) => ({
        indexes: findTarget(window.map((rank) => ({ rank, count: 1 }))),
        label: `顺子（到${highLabel(window)}）`,
      })),
    );

  const takeFullHouses = (): void =>
    takeRepeatedly("full-house", () =>
      ranks.flatMap((tripleRank) =>
        ranks
          .filter((pairRank) => pairRank !== tripleRank)
          .map((pairRank) => ({
            indexes: findTarget([
              { rank: tripleRank, count: 3 },
              { rank: pairRank, count: 2 },
            ]),
            label: `三带二（${rankLabels[tripleRank]}带${rankLabels[pairRank]}）`,
          })),
      ),
    );

  const takeRankGroups = (): void => {
    ranks.forEach((rank) => {
      const indexes = Array.from(remaining).filter(
        (index) => rankOf(hand[index]) === rank,
      );
      while (indexes.length >= 3) {
        addGroup("triple", `三张${rankLabels[rank]}`, indexes.splice(0, 3));
      }
      while (indexes.length >= 2) {
        addGroup("pair", `对子${rankLabels[rank]}`, indexes.splice(0, 2));
      }
    });
  };

  if (strategy === "sequences") {
    takeStraightFlushes();
    takeStraights();
    takeConsecutivePairs();
    takeConsecutiveTriples();
    takeFullHouses();
    takeRankGroups();
  } else if (strategy === "sets") {
    takeConsecutiveTriples();
    takeConsecutivePairs();
    takeFullHouses();
    takeRankGroups();
    takeStraightFlushes();
    takeStraights();
  } else {
    takeStraightFlushes();
    takeConsecutiveTriples();
    takeConsecutivePairs();
    takeStraights();
    takeFullHouses();
    takeRankGroups();
  }

  Array.from(remaining).forEach((index) => {
    const card = hand[index];
    const label =
      "Joker" in card
        ? card.Joker === "Big"
          ? "大王"
          : "小王"
        : `单张${rankLabels[card.Suited.rank]}`;
    addGroup("single", label, [index]);
  });

  return groups;
};
