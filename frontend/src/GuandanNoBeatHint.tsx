import * as React from "react";

import { GuandanStateContext } from "./GuandanStateProvider";
import type { GuandanCard, GuandanRank, GuandanSuit } from "./guandanProtocol";

type Pattern =
  | "single"
  | "pair"
  | "triple"
  | "triple_with_pair"
  | "straight"
  | "straight_flush"
  | "consecutive_pairs"
  | "consecutive_triples"
  | "bomb"
  | "joker_bomb";

interface Strength {
  pattern: Pattern;
  mainRank: GuandanRank;
  cardCount: number;
  joker: "Small" | "Big" | null;
}

interface SuggestionScore {
  patternPenalty: number;
  bombBreaks: number;
  levelCards: number;
  bombTier: number;
  mainPower: number;
  cardTotal: number;
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

const suitOrder: Record<GuandanSuit, number> = {
  Clubs: 0,
  Diamonds: 1,
  Spades: 2,
  Hearts: 3,
};

const naturalRankValue = (rank: GuandanRank): number => ranks.indexOf(rank) + 2;

const rankOf = (card: GuandanCard): GuandanRank | null =>
  "Suited" in card ? card.Suited.rank : null;

const suitOf = (card: GuandanCard): GuandanSuit | null =>
  "Suited" in card ? card.Suited.suit : null;

const isLevelWildcard = (card: GuandanCard, level: GuandanRank): boolean =>
  "Suited" in card &&
  card.Suited.suit === "Hearts" &&
  card.Suited.rank === level;

const sameFaceRank = (cards: GuandanCard[]): boolean => {
  if (cards.length === 0) return false;
  const first = cards[0];
  if ("Joker" in first) {
    return cards.every((card) => "Joker" in card && card.Joker === first.Joker);
  }
  return cards.every(
    (card) => "Suited" in card && card.Suited.rank === first.Suited.rank,
  );
};

const rankCounts = (cards: GuandanCard[]): Map<GuandanRank, number> | null => {
  const counts = new Map<GuandanRank, number>();
  cards.forEach((card) => {
    const rank = rankOf(card);
    if (rank !== null) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  });
  return cards.every((card) => rankOf(card) !== null) ? counts : null;
};

const consecutive = (input: GuandanRank[]): boolean => {
  const values = Array.from(new Set(input.map(naturalRankValue))).sort(
    (a, b) => a - b,
  );
  return (
    values.length === input.length &&
    values.every(
      (value, index) => index === 0 || value === values[index - 1] + 1,
    )
  );
};

const isAceLowStraightRanks = (input: GuandanRank[]): boolean => {
  const rankSet = new Set(input);
  return (
    rankSet.size === 5 &&
    rankSet.has("Ace") &&
    rankSet.has("Two") &&
    rankSet.has("Three") &&
    rankSet.has("Four") &&
    rankSet.has("Five")
  );
};

const straightTargets = (): GuandanRank[][] => {
  const targets: GuandanRank[][] = [
    ["Ace", "Two", "Three", "Four", "Five"],
  ];
  for (let start = 0; start <= 8; start += 1) {
    targets.push(ranks.slice(start, start + 5));
  }
  return targets;
};

const isStraight = (cards: GuandanCard[]): boolean => {
  if (cards.length !== 5) return false;
  const counts = rankCounts(cards);
  if (
    counts === null ||
    Array.from(counts.values()).some((count) => count !== 1)
  ) {
    return false;
  }
  const straightRanks = Array.from(counts.keys());
  return consecutive(straightRanks) || isAceLowStraightRanks(straightRanks);
};

const classify = (cards: GuandanCard[]): Pattern | null => {
  if (cards.length === 0) return null;
  if (cards.length === 1) return "single";
  if (cards.length === 2) return sameFaceRank(cards) ? "pair" : null;
  if (cards.length === 3) return sameFaceRank(cards) ? "triple" : null;
  if (cards.length === 4) {
    if (cards.every((card) => "Joker" in card)) return "joker_bomb";
    return sameFaceRank(cards) ? "bomb" : null;
  }
  if (cards.length === 5) {
    if (sameFaceRank(cards)) return "bomb";
    if (isStraight(cards)) {
      const firstSuit = suitOf(cards[0]);
      if (
        firstSuit !== null &&
        cards.every((card) => suitOf(card) === firstSuit)
      ) {
        return "straight_flush";
      }
      return "straight";
    }
    const counts = rankCounts(cards);
    if (counts !== null) {
      const multiplicities = Array.from(counts.values()).sort((a, b) => a - b);
      if (
        multiplicities.length === 2 &&
        multiplicities[0] === 2 &&
        multiplicities[1] === 3
      ) {
        return "triple_with_pair";
      }
    }
    return null;
  }
  if (cards.length === 6) {
    if (sameFaceRank(cards)) return "bomb";
    const counts = rankCounts(cards);
    if (counts !== null) {
      const entries = Array.from(counts.entries()).sort(
        (a, b) => naturalRankValue(a[0]) - naturalRankValue(b[0]),
      );
      if (
        entries.length === 3 &&
        entries.every((entry) => entry[1] === 2) &&
        consecutive(entries.map((entry) => entry[0]))
      ) {
        return "consecutive_pairs";
      }
      if (
        entries.length === 2 &&
        entries.every((entry) => entry[1] === 3) &&
        consecutive(entries.map((entry) => entry[0]))
      ) {
        return "consecutive_triples";
      }
    }
    return null;
  }
  return sameFaceRank(cards) ? "bomb" : null;
};

const sequenceMainRank = (cards: GuandanCard[]): GuandanRank | null => {
  const cardRanks = cards
    .map(rankOf)
    .filter((rank): rank is GuandanRank => rank !== null);
  if (isAceLowStraightRanks(cardRanks)) return "Five";
  return cardRanks.sort((a, b) => naturalRankValue(a) - naturalRankValue(b)).at(-1) ?? null;
};

const strength = (cards: GuandanCard[]): Strength | null => {
  const pattern = classify(cards);
  if (pattern === null) return null;

  if (
    (pattern === "single" || pattern === "pair" || pattern === "triple") &&
    "Joker" in cards[0]
  ) {
    return {
      pattern,
      mainRank: "Ace",
      cardCount: cards.length,
      joker: cards[0].Joker,
    };
  }

  let mainRank: GuandanRank = "Ace";
  if (pattern === "triple_with_pair") {
    const counts = rankCounts(cards)!;
    const triple = Array.from(counts.entries()).find((entry) => entry[1] === 3);
    if (triple !== undefined) mainRank = triple[0];
  } else if (
    pattern === "straight" ||
    pattern === "straight_flush" ||
    pattern === "consecutive_pairs" ||
    pattern === "consecutive_triples"
  ) {
    mainRank = sequenceMainRank(cards) ?? "Ace";
  } else if (pattern !== "joker_bomb") {
    mainRank = rankOf(cards[0])!;
  }

  return { pattern, mainRank, cardCount: cards.length, joker: null };
};

const targetFits = (
  fixed: GuandanCard[],
  targets: Array<[GuandanRank, number]>,
  wildCount: number,
): boolean => {
  const counts = rankCounts(fixed);
  if (counts === null) return false;
  if (
    Array.from(counts.keys()).some(
      (rank) => !targets.some(([target]) => target === rank),
    )
  ) {
    return false;
  }
  let missing = 0;
  for (const [rank, needed] of targets) {
    const present = counts.get(rank) ?? 0;
    if (present > needed) return false;
    missing += needed - present;
  }
  return missing === wildCount;
};

const strengthsAtLevel = (
  cards: GuandanCard[],
  level: GuandanRank,
): Strength[] => {
  if (!cards.some((card) => isLevelWildcard(card, level))) {
    const basic = strength(cards);
    return basic === null ? [] : [basic];
  }

  const fixed = cards.filter((card) => !isLevelWildcard(card, level));
  const wildCount = cards.length - fixed.length;
  const result: Strength[] = [];
  const add = (pattern: Pattern, mainRank: GuandanRank): void => {
    const candidate: Strength = {
      pattern,
      mainRank,
      cardCount: cards.length,
      joker: null,
    };
    if (
      !result.some(
        (item) =>
          item.pattern === candidate.pattern &&
          item.mainRank === candidate.mainRank &&
          item.cardCount === candidate.cardCount,
      )
    ) {
      result.push(candidate);
    }
  };

  const addSameRank = (pattern: Pattern): void => {
    ranks.forEach((rank) => {
      if (targetFits(fixed, [[rank, cards.length]], wildCount)) {
        add(pattern, rank);
      }
    });
  };

  if (cards.length === 1) {
    add("single", level);
    return result;
  }
  if (cards.length === 2) {
    addSameRank("pair");
    return result;
  }
  if (cards.length === 3) {
    addSameRank("triple");
    return result;
  }
  if (cards.length === 4) {
    addSameRank("bomb");
    return result;
  }
  if (cards.length === 5) {
    addSameRank("bomb");

    straightTargets().forEach((target) => {
      const targetCounts = target.map(
        (rank): [GuandanRank, number] => [rank, 1],
      );
      if (!targetFits(fixed, targetCounts, wildCount)) return;
      const mainRank = isAceLowStraightRanks(target)
        ? "Five"
        : target[target.length - 1];
      add("straight", mainRank);
      const fixedSuits = fixed
        .map(suitOf)
        .filter((suit): suit is GuandanSuit => suit !== null);
      if (
        fixedSuits.length === fixed.length &&
        (fixedSuits.length === 0 ||
          fixedSuits.every((suit) => suit === fixedSuits[0]))
      ) {
        add("straight_flush", mainRank);
      }
    });

    ranks.forEach((triple) => {
      ranks.forEach((pair) => {
        if (
          triple !== pair &&
          targetFits(
            fixed,
            [
              [triple, 3],
              [pair, 2],
            ],
            wildCount,
          )
        ) {
          add("triple_with_pair", triple);
        }
      });
    });
    return result;
  }
  if (cards.length === 6) {
    addSameRank("bomb");
    for (let start = 0; start <= ranks.length - 3; start += 1) {
      const targets: Array<[GuandanRank, number]> = [
        [ranks[start], 2],
        [ranks[start + 1], 2],
        [ranks[start + 2], 2],
      ];
      if (targetFits(fixed, targets, wildCount)) {
        add("consecutive_pairs", ranks[start + 2]);
      }
    }
    for (let start = 0; start <= ranks.length - 2; start += 1) {
      const targets: Array<[GuandanRank, number]> = [
        [ranks[start], 3],
        [ranks[start + 1], 3],
      ];
      if (targetFits(fixed, targets, wildCount)) {
        add("consecutive_triples", ranks[start + 1]);
      }
    }
    return result;
  }

  addSameRank("bomb");
  return result;
};

const bombTier = (play: Strength): number => {
  if (play.pattern === "joker_bomb") return Number.MAX_SAFE_INTEGER;
  if (play.pattern === "straight_flush") return 5;
  if (play.pattern === "bomb") {
    if (play.cardCount <= 4) return 3;
    if (play.cardCount === 5) return 4;
    return play.cardCount;
  }
  return 0;
};

const isBombFamily = (pattern: Pattern): boolean =>
  pattern === "bomb" ||
  pattern === "straight_flush" ||
  pattern === "joker_bomb";

const mainPower = (play: Strength, level: GuandanRank): number => {
  if (play.joker === "Small") return 16;
  if (play.joker === "Big") return 17;
  if (play.mainRank === level) return 15;
  return naturalRankValue(play.mainRank);
};

const sequencePower = (rank: GuandanRank): number => naturalRankValue(rank);

const beats = (
  candidate: Strength,
  current: Strength,
  level: GuandanRank,
): boolean => {
  const candidateBomb = isBombFamily(candidate.pattern);
  const currentBomb = isBombFamily(current.pattern);

  if (candidateBomb && !currentBomb) return true;
  if (!candidateBomb && currentBomb) return false;

  if (candidateBomb && currentBomb) {
    const tierDifference = bombTier(candidate) - bombTier(current);
    if (tierDifference !== 0) return tierDifference > 0;
    if (
      candidate.pattern === "joker_bomb" &&
      current.pattern === "joker_bomb"
    ) {
      return false;
    }
    if (
      candidate.pattern === "straight_flush" &&
      current.pattern === "straight_flush"
    ) {
      return sequencePower(candidate.mainRank) > sequencePower(current.mainRank);
    }
    if (
      candidate.pattern === "bomb" &&
      current.pattern === "bomb" &&
      candidate.cardCount === current.cardCount
    ) {
      return mainPower(candidate, level) > mainPower(current, level);
    }
    return false;
  }

  if (
    candidate.pattern !== current.pattern ||
    candidate.cardCount !== current.cardCount
  ) {
    return false;
  }

  const sequence =
    candidate.pattern === "straight" ||
    candidate.pattern === "consecutive_pairs" ||
    candidate.pattern === "consecutive_triples";
  return sequence
    ? sequencePower(candidate.mainRank) > sequencePower(current.mainRank)
    : mainPower(candidate, level) > mainPower(current, level);
};

const combinations = (
  cards: GuandanCard[],
  size: number,
  start = 0,
  chosen: GuandanCard[] = [],
): GuandanCard[][] => {
  if (chosen.length === size) return [chosen];
  const result: GuandanCard[][] = [];
  for (
    let index = start;
    index <= cards.length - (size - chosen.length);
    index += 1
  ) {
    result.push(
      ...combinations(cards, size, index + 1, chosen.concat(cards[index])),
    );
  }
  return result;
};

const indexCombinations = (
  length: number,
  size: number,
  start = 0,
  chosen: number[] = [],
): number[][] => {
  if (chosen.length === size) return [chosen];
  const result: number[][] = [];
  for (
    let index = start;
    index <= length - (size - chosen.length);
    index += 1
  ) {
    result.push(
      ...indexCombinations(length, size, index + 1, chosen.concat(index)),
    );
  }
  return result;
};

const hasAnyBomb = (hand: GuandanCard[], level: GuandanRank): boolean => {
  const suitedCounts = new Map<GuandanRank, number>();
  let jokers = 0;
  let wildCount = 0;
  hand.forEach((card) => {
    if (isLevelWildcard(card, level)) {
      wildCount += 1;
    } else if ("Joker" in card) {
      jokers += 1;
    } else {
      suitedCounts.set(
        card.Suited.rank,
        (suitedCounts.get(card.Suited.rank) ?? 0) + 1,
      );
    }
  });
  if (
    jokers >= 4 ||
    Array.from(suitedCounts.values()).some((count) => count + wildCount >= 4)
  ) {
    return true;
  }

  const targets = straightTargets();
  return (Object.keys(suitOrder) as GuandanSuit[]).some((suit) => {
    const present = new Set<GuandanRank>();
    hand.forEach((card) => {
      if (
        "Suited" in card &&
        !isLevelWildcard(card, level) &&
        card.Suited.suit === suit
      ) {
        present.add(card.Suited.rank);
      }
    });
    return targets.some(
      (target) =>
        target.filter((rank) => present.has(rank)).length + wildCount >= 5,
    );
  });
};

const beatsAllTableInterpretations = (
  candidate: Strength,
  currentStrengths: Strength[],
  level: GuandanRank,
): boolean => currentStrengths.every((current) => beats(candidate, current, level));

export const handCanBeat = (
  hand: GuandanCard[],
  currentCards: GuandanCard[],
  level: GuandanRank,
): boolean => {
  const currentStrengths = strengthsAtLevel(currentCards, level);
  if (currentStrengths.length === 0) return true;
  const currentHasBombInterpretation = currentStrengths.some((current) =>
    isBombFamily(current.pattern),
  );
  if (!currentHasBombInterpretation && hasAnyBomb(hand, level)) return true;

  const sizes = new Set<number>();
  if (!currentHasBombInterpretation) sizes.add(currentCards.length);
  else {
    sizes.add(4);
    sizes.add(5);
    sizes.add(6);
  }

  const sizesToCheck = Array.from(sizes);
  for (let sizeIndex = 0; sizeIndex < sizesToCheck.length; sizeIndex += 1) {
    const size = sizesToCheck[sizeIndex];
    if (size > hand.length) continue;
    const candidateGroups = combinations(hand, size);
    for (
      let candidateIndex = 0;
      candidateIndex < candidateGroups.length;
      candidateIndex += 1
    ) {
      const candidates = strengthsAtLevel(candidateGroups[candidateIndex], level);
      if (
        candidates.some((candidate) =>
          beatsAllTableInterpretations(candidate, currentStrengths, level),
        )
      ) {
        return true;
      }
    }
  }

  if (currentHasBombInterpretation) {
    const wildcards = hand.filter((card) => isLevelWildcard(card, level));
    const byRank = new Map<GuandanRank, GuandanCard[]>();
    hand.forEach((card) => {
      if ("Suited" in card && !isLevelWildcard(card, level)) {
        const group = byRank.get(card.Suited.rank) ?? [];
        group.push(card);
        byRank.set(card.Suited.rank, group);
      }
    });
    const groups = Array.from(byRank.values());
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex].concat(wildcards);
      for (let size = 7; size <= group.length; size += 1) {
        const candidates = strengthsAtLevel(group.slice(0, size), level);
        if (
          candidates.some((candidate) =>
            beatsAllTableInterpretations(candidate, currentStrengths, level),
          )
        ) {
          return true;
        }
      }
    }
  }

  return false;
};

const cardSortValue = (card: GuandanCard, level: GuandanRank): number => {
  if ("Joker" in card) return card.Joker === "Small" ? 1000 : 1100;
  const base = ranks.indexOf(card.Suited.rank);
  return (
    (card.Suited.rank === level ? 900 : base * 10) + suitOrder[card.Suited.suit]
  );
};

const bombBreakPenalty = (hand: GuandanCard[], indexes: number[]): number => {
  const handRanks = new Map<GuandanRank, number>();
  const selectedRanks = new Map<GuandanRank, number>();
  let handJokers = 0;
  let selectedJokers = 0;
  const selected = new Set(indexes);

  hand.forEach((card, index) => {
    if ("Joker" in card) {
      handJokers += 1;
      if (selected.has(index)) selectedJokers += 1;
      return;
    }
    handRanks.set(card.Suited.rank, (handRanks.get(card.Suited.rank) ?? 0) + 1);
    if (selected.has(index)) {
      selectedRanks.set(
        card.Suited.rank,
        (selectedRanks.get(card.Suited.rank) ?? 0) + 1,
      );
    }
  });

  let penalty = 0;
  Array.from(handRanks.entries()).forEach(([rank, count]) => {
    const used = selectedRanks.get(rank) ?? 0;
    if (count >= 4 && used > 0 && used < count) penalty += 1;
  });
  if (handJokers >= 4 && selectedJokers > 0 && selectedJokers < handJokers) {
    penalty += 1;
  }
  return penalty;
};

const candidateMainPower = (candidate: Strength, level: GuandanRank): number =>
  candidate.pattern === "straight" ||
  candidate.pattern === "straight_flush" ||
  candidate.pattern === "consecutive_pairs" ||
  candidate.pattern === "consecutive_triples"
    ? sequencePower(candidate.mainRank)
    : mainPower(candidate, level);

const suggestionScore = (
  hand: GuandanCard[],
  indexes: number[],
  candidate: Strength,
  current: Strength,
  level: GuandanRank,
): SuggestionScore => ({
  patternPenalty:
    !isBombFamily(current.pattern) && candidate.pattern === current.pattern
      ? 0
      : 1,
  // A bomb is not considered "broken" when the suggested play is itself a
  // bomb. This lets the hint choose the smallest sufficient bomb instead of
  // unnecessarily consuming every duplicate card of the same rank.
  bombBreaks:
    candidate.pattern === "bomb" || candidate.pattern === "joker_bomb"
    ? 0
    : bombBreakPenalty(hand, indexes),
  levelCards: indexes.filter((index) => rankOf(hand[index]) === level).length,
  bombTier: isBombFamily(candidate.pattern) ? bombTier(candidate) : 0,
  mainPower: candidateMainPower(candidate, level),
  cardTotal: indexes.reduce(
    (total, index) => total + cardSortValue(hand[index], level),
    0,
  ),
});

const compareSuggestionScores = (
  left: SuggestionScore,
  right: SuggestionScore,
): number =>
  left.patternPenalty - right.patternPenalty ||
  left.bombBreaks - right.bombBreaks ||
  left.levelCards - right.levelCards ||
  left.bombTier - right.bombTier ||
  left.mainPower - right.mainPower ||
  left.cardTotal - right.cardTotal;

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

export const describeSuggestedCards = (
  cards: GuandanCard[],
  level?: GuandanRank,
): string | null => {
  const play = level === undefined ? strength(cards) : strengthsAtLevel(cards, level)[0] ?? null;
  if (play === null) return null;
  const rank =
    play.joker === "Small"
      ? "小王"
      : play.joker === "Big"
        ? "大王"
        : rankLabels[play.mainRank];

  switch (play.pattern) {
    case "single":
      return `单张${rank}`;
    case "pair":
      return `对${rank}`;
    case "triple":
      return `三张${rank}`;
    case "triple_with_pair":
      return `三带二（${rank}）`;
    case "straight":
      return `顺子（到${rank}）`;
    case "straight_flush":
      return `同花顺（到${rank}）`;
    case "consecutive_pairs":
      return `连对（到${rank}）`;
    case "consecutive_triples":
      return `连三张（到${rank}）`;
    case "bomb":
      return `${play.cardCount}炸${rank}`;
    case "joker_bomb":
      return "王炸";
  }
};

export const findSuggestedIndexes = (
  hand: GuandanCard[],
  currentCards: GuandanCard[],
  level: GuandanRank,
): number[] => {
  const currentStrengths = strengthsAtLevel(currentCards, level);
  if (currentStrengths.length === 0) return [];
  const scoringCurrent = currentStrengths[0];
  const currentHasBombInterpretation = currentStrengths.some((current) =>
    isBombFamily(current.pattern),
  );

  const sizes: number[] = [];
  const addSize = (size: number): void => {
    if (size <= hand.length && !sizes.includes(size)) sizes.push(size);
  };
  if (!currentHasBombInterpretation) addSize(currentCards.length);
  addSize(4);
  addSize(5);
  addSize(6);

  const candidates: Array<{
    indexes: number[];
    strength: Strength;
    score: SuggestionScore;
  }> = [];
  const addCandidate = (indexes: number[]): void => {
    const cards = indexes.map((index) => hand[index]);
    const interpretations = strengthsAtLevel(cards, level).filter((candidate) =>
      beatsAllTableInterpretations(candidate, currentStrengths, level),
    );
    interpretations.forEach((candidate) => {
      candidates.push({
        indexes,
        strength: candidate,
        score: suggestionScore(
          hand,
          indexes,
          candidate,
          scoringCurrent,
          level,
        ),
      });
    });
  };

  sizes.forEach((size) => {
    indexCombinations(hand.length, size).forEach(addCandidate);
  });

  const wildcardIndexes: number[] = [];
  const byRank = new Map<GuandanRank, number[]>();
  hand.forEach((card, index) => {
    if (isLevelWildcard(card, level)) {
      wildcardIndexes.push(index);
    } else if ("Suited" in card) {
      const group = byRank.get(card.Suited.rank) ?? [];
      group.push(index);
      byRank.set(card.Suited.rank, group);
    }
  });
  Array.from(byRank.values()).forEach((group) => {
    const extended = group.concat(wildcardIndexes);
    for (let size = 7; size <= extended.length; size += 1) {
      addCandidate(extended.slice(0, size));
    }
  });

  candidates.sort((left, right) =>
    compareSuggestionScores(left.score, right.score),
  );
  return candidates[0]?.indexes ?? [];
};

const selectSuggestedCards = (
  hand: GuandanCard[],
  indexes: number[],
  level: GuandanRank,
): void => {
  const ordered = hand
    .map((card, originalIndex) => ({ card, originalIndex }))
    .sort(
      (a, b) =>
        cardSortValue(a.card, level) - cardSortValue(b.card, level) ||
        a.originalIndex - b.originalIndex,
    );
  const desired = new Set(indexes);
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    ".guandan-hand button",
  );

  buttons.forEach((button, visibleIndex) => {
    const originalIndex = ordered[visibleIndex]?.originalIndex;
    if (originalIndex === undefined) return;
    const shouldBeSelected = desired.has(originalIndex);
    const isSelected = button.getAttribute("aria-pressed") === "true";
    if (shouldBeSelected !== isSelected) button.click();
  });
};

const GuandanNoBeatHint: React.FunctionComponent = () => {
  const { state } = React.useContext(GuandanStateContext);
  const [suggestionText, setSuggestionText] = React.useState<string | null>(
    null,
  );
  const shouldCheck =
    state.seat !== null &&
    state.turn === state.seat &&
    state.lastPlayer !== null &&
    state.lastPlay.length > 0 &&
    state.level !== null &&
    state.pendingTribute === null &&
    !state.trickComplete &&
    state.hand.length > 0;

  const canBeat = React.useMemo(
    () =>
      !shouldCheck || state.level === null
        ? true
        : handCanBeat(state.hand, state.lastPlay, state.level),
    [shouldCheck, state.hand, state.lastPlay, state.level],
  );

  React.useEffect(() => {
    setSuggestionText(null);
  }, [state.lastPlay, state.turn]);

  if (!shouldCheck || state.level === null) return null;

  if (!canBeat) {
    return (
      <div
        role="status"
        style={{
          margin: "8px auto",
          padding: "8px 12px",
          maxWidth: "520px",
          textAlign: "center",
          fontWeight: 700,
          border: "1px solid currentColor",
          borderRadius: "8px",
        }}
      >
        ⚠️ 你没有可大过的牌，请过牌
      </div>
    );
  }

  const showSuggestion = (): void => {
    const indexes = findSuggestedIndexes(
      state.hand,
      state.lastPlay,
      state.level!,
    );
    selectSuggestedCards(state.hand, indexes, state.level!);
    const description = describeSuggestedCards(
      indexes.map((index) => state.hand[index]),
      state.level!,
    );
    setSuggestionText(description);
  };

  return (
    <div style={{ margin: "8px auto", textAlign: "center" }}>
      <button type="button" className="normal" onClick={showSuggestion}>
        提示出牌
      </button>
      {suggestionText !== null && (
        <div role="status" style={{ marginTop: "6px", fontWeight: 700 }}>
          建议：{suggestionText}
        </div>
      )}
    </div>
  );
};

export default GuandanNoBeatHint;
