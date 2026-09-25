import { RANKS } from "../dist/core/cards.js";
import { canHandBeatWithLevel } from "../dist/core/hand.js";
import { classifyHandWithLevel } from "../dist/core/level-hand.js";

const rankIndex = (rank) => RANKS.indexOf(rank);
const isSuited = (deckCard) => deckCard.card.kind === "suited";
const isWildcard = (deckCard, levelRank) =>
  deckCard.card.kind === "suited" &&
  deckCard.card.suit === "hearts" &&
  deckCard.card.rank === levelRank;

const combinations = (items, count) => {
  const out = [];
  const walk = (start, chosen) => {
    if (chosen.length === count) {
      out.push([...chosen]);
      return;
    }
    for (let i = start; i <= items.length - (count - chosen.length); i += 1) {
      chosen.push(items[i]);
      walk(i + 1, chosen);
      chosen.pop();
    }
  };
  if (count >= 0 && count <= items.length) walk(0, []);
  return out;
};

const chooseOnePerRank = (buckets, ranks, wildcardCards, copies = 1) => {
  const slots = [];
  let needWild = 0;
  for (const rank of ranks) {
    const cards = buckets.get(rank) ?? [];
    if (cards.length >= copies) slots.push(cards.slice(0, copies));
    else {
      slots.push(cards);
      needWild += copies - cards.length;
    }
  }
  if (needWild > wildcardCards.length) return null;
  return [...slots.flat(), ...wildcardCards.slice(0, needWild)];
};

const sequenceWindows = (length) => {
  const regular = RANKS.filter((r) => r !== "2");
  const windows = [];
  for (let i = 0; i + length <= regular.length; i += 1) {
    windows.push(regular.slice(i, i + length));
  }
  if (length === 5) {
    windows.push(["A", "2", "3", "4", "5"]);
    windows.push(["2", "3", "4", "5", "6"]);
  }
  return windows;
};

const candidateKey = (cards) => cards.map((c) => c.id).sort().join("|");

export const generateLegalCandidates = (hand, levelRank, leadingHand = null) => {
  const wildcardCards = hand.filter((c) => isWildcard(c, levelRank));
  const fixedSuited = hand.filter((c) => isSuited(c) && !isWildcard(c, levelRank));
  const byRank = new Map();
  for (const card of fixedSuited) {
    const rank = card.card.rank;
    if (!byRank.has(rank)) byRank.set(rank, []);
    byRank.get(rank).push(card);
  }
  const candidates = new Map();
  const add = (cards) => {
    if (!cards || cards.length === 0) return;
    const classified = classifyHandWithLevel(cards.map((c) => c.card), levelRank);
    if (classified.kind === "invalid") return;
    if (leadingHand && !canHandBeatWithLevel(classified, leadingHand, levelRank)) return;
    candidates.set(candidateKey(cards), { cards, hand: classified });
  };

  for (const card of hand) add([card]);

  for (const rank of RANKS) {
    const fixed = byRank.get(rank) ?? [];
    const pool = [...fixed, ...wildcardCards];
    for (const size of [2, 3, 4, 5, 6, 7, 8]) {
      if (pool.length < size) continue;
      for (const combo of combinations(pool, size)) {
        if (combo.every((c) => isWildcard(c, levelRank))) continue;
        add(combo);
      }
    }
  }

  const small = hand.filter((c) => c.card.kind === "joker" && c.card.size === "small");
  const big = hand.filter((c) => c.card.kind === "joker" && c.card.size === "big");
  if (small.length >= 2) add(small.slice(0, 2));
  if (big.length >= 2) add(big.slice(0, 2));
  if (small.length >= 2 && big.length >= 2) add([...small.slice(0, 2), ...big.slice(0, 2)]);

  for (const ranks of sequenceWindows(5)) {
    add(chooseOnePerRank(byRank, ranks, wildcardCards, 1));
    for (const suit of ["clubs", "diamonds", "spades", "hearts"]) {
      const suitedBuckets = new Map();
      for (const rank of ranks) {
        suitedBuckets.set(
          rank,
          (byRank.get(rank) ?? []).filter((c) => c.card.kind === "suited" && c.card.suit === suit),
        );
      }
      add(chooseOnePerRank(suitedBuckets, ranks, wildcardCards, 1));
    }
  }

  for (const ranks of sequenceWindows(3)) {
    add(chooseOnePerRank(byRank, ranks, wildcardCards, 2));
  }
  for (const ranks of sequenceWindows(2)) {
    add(chooseOnePerRank(byRank, ranks, wildcardCards, 3));
  }

  for (const tripleRank of RANKS) {
    for (const pairRank of RANKS) {
      if (tripleRank === pairRank) continue;
      const tripleFixed = (byRank.get(tripleRank) ?? []).slice(0, 3);
      const pairFixed = (byRank.get(pairRank) ?? []).slice(0, 2);
      const need = 5 - tripleFixed.length - pairFixed.length;
      if (need < 0 || need > wildcardCards.length) continue;
      const cards = [...tripleFixed, ...pairFixed, ...wildcardCards.slice(0, need)];
      if (cards.length === 5) add(cards);
    }
  }

  return [...candidates.values()];
};

const isBombLike = (h) => ["bomb", "straight-flush", "joker-bomb"].includes(h.kind);
const isStructure = (h) => !["single", "invalid"].includes(h.kind);
const handStrength = (h) => {
  if (h.kind === "joker-bomb") return 100000;
  if (h.kind === "bomb") return 50000 + h.size * 100 + rankIndex(h.rank ?? "2");
  if (h.kind === "straight-flush") return 45000 + rankIndex(h.highRank ?? "2");
  if (h.jokerSize) return 1000 + (h.jokerSize === "big" ? 2 : 1);
  return rankIndex(h.rank ?? h.highRank ?? "2");
};

const publicPartnerSeat = (seat, playerCount) =>
  playerCount === 4 ? (seat + 2) % 4 : null;

const opponentSeats = (seat, playerCount) =>
  Array.from({ length: playerCount }, (_, s) => s).filter(
    (s) => s !== seat && s !== publicPartnerSeat(seat, playerCount),
  );

const structureBreakPenalty = (candidate, allCandidates) => {
  if (candidate.hand.kind !== "single") return 0;
  const id = candidate.cards[0].id;
  return allCandidates.some((c) => isStructure(c.hand) && c.cards.some((x) => x.id === id)) ? 35 : 0;
};

export const createPublicMemory = (playerCount) => ({
  playedBySeat: Array.from({ length: playerCount }, () => []),
  passBySeat: Array.from({ length: playerCount }, () => 0),
  decisions: [],
});

export const recordPublicPlay = (memory, seat, cards, hand) => {
  memory.playedBySeat[seat].push(...cards.map((c) => c.card));
  memory.decisions.push({ type: "play", seat, kind: hand.kind, size: hand.size });
};

export const recordPublicPass = (memory, seat) => {
  memory.passBySeat[seat] += 1;
  memory.decisions.push({ type: "pass", seat });
};

export const chooseExpertAction = ({
  hand,
  levelRank,
  leadingPlay,
  seat,
  playerCount,
  handCounts,
  finishedSeats,
  publicMemory,
}) => {
  const leadingHand = leadingPlay?.hand ?? null;
  const candidates = generateLegalCandidates(hand, levelRank, leadingHand);
  if (candidates.length === 0) {
    return { type: "pass", reason: "no-legal-overtake", tactics: ["playedCardMemory"] };
  }

  const partner = publicPartnerSeat(seat, playerCount);
  const partnerLeading = partner !== null && leadingPlay?.seat === partner;
  const partnerNearOut = partner !== null && (handCounts[partner] ?? 99) <= 2;
  const partnerFinished = partner !== null && finishedSeats.includes(partner);
  const opponents = opponentSeats(seat, playerCount);
  const opponentNearOut = opponents.some((s) => (handCounts[s] ?? 99) <= 2 && !finishedSeats.includes(s));
  const ownNearOut = hand.length <= 5;
  const leading = leadingHand === null;

  if (partnerLeading && !opponentNearOut && !ownNearOut) {
    return {
      type: "pass",
      reason: "partner-yield",
      tactics: [
        "partnerYielding",
        "roleSelectionFromLegalInformation",
        "playedCardMemory",
        ...(partnerNearOut ? ["dynamicRoleSwitch"] : []),
      ],
    };
  }

  let best = null;
  let bestScore = Infinity;
  const allOpenCandidates = generateLegalCandidates(hand, levelRank, null);
  for (const candidate of candidates) {
    const h = candidate.hand;
    let score = handStrength(h);

    score -= candidate.cards.length * (leading ? 22 : 8);
    score += structureBreakPenalty(candidate, allOpenCandidates);
    if (isBombLike(h)) score += opponentNearOut || ownNearOut ? 150 : 5000;
    const wildcardUse = candidate.cards.filter((c) => isWildcard(c, levelRank)).length;
    score += wildcardUse * (ownNearOut ? 5 : 90);

    if (leading) {
      if (["straight", "consecutive-pairs", "consecutive-triples", "full-house"].includes(h.kind)) score -= 180;
      if (h.kind === "single") score += 40;
    } else {
      score += handStrength(h) * 2;
    }

    if (leading && partnerNearOut && ["single", "pair"].includes(h.kind)) score -= 220;
    if (opponentNearOut) score -= candidate.cards.length * 20;

    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  const tactics = [
    "handStructureAssessment",
    "roleSelectionFromLegalInformation",
    "minimumSufficientOvertake",
    "playedCardMemory",
    "remainingCardInferenceWithoutHiddenInfo",
  ];
  if (leading && partnerNearOut) tactics.push("partnerFeeding");
  if (partnerNearOut || opponentNearOut || ownNearOut) tactics.push("dynamicRoleSwitch");
  if (leading && partnerFinished) tactics.push("partnerCatchLeadExploitation");
  if (opponentNearOut) tactics.push("opponentSprintBlock", "endgameModeSwitch");
  if (best && isBombLike(best.hand)) tactics.push("bombForControlWithFollowup");
  else tactics.push("bombConservation");
  if (best?.cards.some((c) => isWildcard(c, levelRank))) tactics.push("wildcardValueOptimization");
  if (ownNearOut) tactics.push("endgameModeSwitch", "upgradeOutcomeOptimization");

  return {
    type: "play",
    cards: best.cards,
    hand: best.hand,
    reason: leading ? "structured-low-burden-lead" : "minimum-sufficient-overtake",
    tactics: [...new Set(tactics)],
  };
};