import * as React from "react";

import { GuandanStateContext } from "./GuandanStateProvider";
import type {
  GuandanCard,
  GuandanRank,
  GuandanSuit,
} from "./guandanProtocol";

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

const naturalRankValue = (rank: GuandanRank): number => ranks.indexOf(rank) + 2;

const rankOf = (card: GuandanCard): GuandanRank | null =>
  "Suited" in card ? card.Suited.rank : null;

const suitOf = (card: GuandanCard): GuandanSuit | null =>
  "Suited" in card ? card.Suited.suit : null;

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
  for (const card of cards) {
    const rank = rankOf(card);
    if (rank === null) return null;
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }
  return counts;
};

const consecutive = (input: GuandanRank[]): boolean => {
  const values = [...new Set(input.map(naturalRankValue))].sort((a, b) => a - b);
  return (
    values.length === input.length &&
    values.every((value, index) => index === 0 || value === values[index - 1] + 1)
  );
};

const isStraight = (cards: GuandanCard[]): boolean => {
  if (cards.length !== 5) return false;
  const counts = rankCounts(cards);
  if (counts === null || [...counts.values()].some((count) => count !== 1)) return false;
  return consecutive([...counts.keys()]);
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
      if (firstSuit !== null && cards.every((card) => suitOf(card) === firstSuit)) {
        return "straight_flush";
      }
      return "straight";
    }
    const counts = rankCounts(cards);
    if (counts !== null) {
      const multiplicities = [...counts.values()].sort((a, b) => a - b);
      if (multiplicities.length === 2 && multiplicities[0] === 2 && multiplicities[1] === 3) {
        return "triple_with_pair";
      }
    }
    return null;
  }
  if (cards.length === 6) {
    if (sameFaceRank(cards)) return "bomb";
    const counts = rankCounts(cards);
    if (counts !== null) {
      const entries = [...counts.entries()].sort(
        (a, b) => naturalRankValue(a[0]) - naturalRankValue(b[0]),
      );
      if (
        entries.length === 3 &&
        entries.every(([, count]) => count === 2) &&
        consecutive(entries.map(([rank]) => rank))
      ) {
        return "consecutive_pairs";
      }
      if (
        entries.length === 2 &&
        entries.every(([, count]) => count === 3) &&
        consecutive(entries.map(([rank]) => rank))
      ) {
        return "consecutive_triples";
      }
    }
    return null;
  }
  return sameFaceRank(cards) ? "bomb" : null;
};

const strength = (cards: GuandanCard[]): Strength | null => {
  const pattern = classify(cards);
  if (pattern === null) return null;
  if ((pattern === "single" || pattern === "pair" || pattern === "triple") && "Joker" in cards[0]) {
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
    mainRank = [...counts.entries()].find(([, count]) => count === 3)![0];
  } else if (
    pattern === "straight" ||
    pattern === "straight_flush" ||
    pattern === "consecutive_pairs" ||
    pattern === "consecutive_triples"
  ) {
    mainRank = [...cards]
      .map(rankOf)
      .filter((rank): rank is GuandanRank => rank !== null)
      .sort((a, b) => naturalRankValue(a) - naturalRankValue(b))
      .at(-1)!;
  } else if (pattern !== "joker_bomb") {
    mainRank = rankOf(cards[0])!;
  }
  return { pattern, mainRank, cardCount: cards.length, joker: null };
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
  pattern === "bomb" || pattern === "straight_flush" || pattern === "joker_bomb";

const mainPower = (play: Strength, level: GuandanRank): number => {
  if (play.joker === "Small") return 16;
  if (play.joker === "Big") return 17;
  if (play.mainRank === level) return 15;
  return naturalRankValue(play.mainRank);
};

const sequencePower = (rank: GuandanRank, level: GuandanRank): number =>
  level === "Two" && rank === "Two" ? 15 : naturalRankValue(rank);

const beats = (candidate: Strength, current: Strength, level: GuandanRank): boolean => {
  const candidateBomb = isBombFamily(candidate.pattern);
  const currentBomb = isBombFamily(current.pattern);
  if (candidateBomb && !currentBomb) return true;
  if (!candidateBomb && currentBomb) return false;
  if (candidateBomb && currentBomb) {
    const tierDifference = bombTier(candidate) - bombTier(current);
    if (tierDifference !== 0) return tierDifference > 0;
    if (candidate.pattern === "joker_bomb" && current.pattern === "joker_bomb") return false;
    if (
      candidate.pattern === "straight_flush" &&
      current.pattern === "straight_flush"
    ) {
      return sequencePower(candidate.mainRank, level) > sequencePower(current.mainRank, level);
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
  if (candidate.pattern !== current.pattern || candidate.cardCount !== current.cardCount) {
    return false;
  }
  const sequence =
    candidate.pattern === "straight" ||
    candidate.pattern === "consecutive_pairs" ||
    candidate.pattern === "consecutive_triples";
  return sequence
    ? sequencePower(candidate.mainRank, level) > sequencePower(current.mainRank, level)
    : mainPower(candidate, level) > mainPower(current, level);
};

const combinations = function* (
  cards: GuandanCard[],
  size: number,
  start = 0,
  chosen: GuandanCard[] = [],
): Generator<GuandanCard[]> {
  if (chosen.length === size) {
    yield chosen;
    return;
  }
  for (let index = start; index <= cards.length - (size - chosen.length); index += 1) {
    yield* combinations(cards, size, index + 1, [...chosen, cards[index]]);
  }
};

const hasAnyBomb = (hand: GuandanCard[]): boolean => {
  const suitedCounts = new Map<GuandanRank, number>();
  let jokers = 0;
  for (const card of hand) {
    if ("Joker" in card) jokers += 1;
    else suitedCounts.set(card.Suited.rank, (suitedCounts.get(card.Suited.rank) ?? 0) + 1);
  }
  return jokers >= 4 || [...suitedCounts.values()].some((count) => count >= 4);
};

const handCanBeat = (
  hand: GuandanCard[],
  currentCards: GuandanCard[],
  level: GuandanRank,
): boolean => {
  const current = strength(currentCards);
  if (current === null) return true;

  if (!isBombFamily(current.pattern) && hasAnyBomb(hand)) return true;

  const sizes = new Set<number>();
  if (!isBombFamily(current.pattern)) sizes.add(current.cardCount);
  else {
    sizes.add(4);
    sizes.add(5);
    sizes.add(6);
  }

  for (const size of sizes) {
    if (size > hand.length) continue;
    for (const candidateCards of combinations(hand, size)) {
      const candidate = strength(candidateCards);
      if (candidate !== null && beats(candidate, current, level)) return true;
    }
  }

  if (isBombFamily(current.pattern)) {
    const byRank = new Map<GuandanRank, GuandanCard[]>();
    for (const card of hand) {
      if ("Suited" in card) {
        const group = byRank.get(card.Suited.rank) ?? [];
        group.push(card);
        byRank.set(card.Suited.rank, group);
      }
    }
    for (const group of byRank.values()) {
      for (let size = 7; size <= group.length; size += 1) {
        const candidate = strength(group.slice(0, size));
        if (candidate !== null && beats(candidate, current, level)) return true;
      }
    }
  }

  return false;
};

const GuandanNoBeatHint: React.FunctionComponent = () => {
  const { state } = React.useContext(GuandanStateContext);
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

  if (!shouldCheck || canBeat) return null;

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
};

export default GuandanNoBeatHint;
