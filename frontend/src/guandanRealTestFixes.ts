import {
  adaptGuandanServerMessage,
  shouldClearOwnHand,
} from "./guandanCompatibilityAdapter";
import type { GuandanTableState } from "./guandanCompatibilityAdapter";
import type {
  GuandanCard,
  GuandanRank,
  GuandanServerMessage,
} from "./guandanProtocol";

type RealTestState = GuandanTableState & {
  __tributePublicCount?: number;
};

const rankOrder: GuandanRank[] = [
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

const suitOrder: Record<string, number> = {
  Clubs: 0,
  Diamonds: 1,
  Spades: 2,
  Hearts: 3,
};

const cardSortValue = (
  card: GuandanCard,
  level: GuandanRank | null,
): number => {
  if ("Joker" in card) return card.Joker === "Small" ? 1000 : 1100;
  const rank = rankOrder.indexOf(card.Suited.rank);
  return (
    (level !== null && card.Suited.rank === level ? 900 : rank * 10) +
    (suitOrder[card.Suited.suit] ?? 0)
  );
};

const sortPlayCards = (
  cards: GuandanCard[],
  level: GuandanRank | null,
): GuandanCard[] =>
  [...cards].sort((a, b) => cardSortValue(a, level) - cardSortValue(b, level));

/**
 * Regression layer for the 2026-09-16 four-human Guandan acceptance test.
 *
 * Guarantees:
 * - public play cards are always rendered small -> large;
 * - EndRound's authoritative empty table snapshot clears the public table;
 * - a finished player's stale private hand is cleared immediately;
 * - tribute/return cards may share table_plays while tribute is active, but are
 *   removed from the visible normal trick as soon as normal play starts.
 */
export const adaptGuandanServerMessageWithRealTestFixes = (
  current: GuandanTableState,
  message: GuandanServerMessage,
): GuandanTableState => {
  const currentFixed = current as RealTestState;
  const adapted = adaptGuandanServerMessage(current, message) as RealTestState;

  if (message.type === "hand") {
    // A private-hand message is authoritative for the current round. It can
    // arrive while React still holds the previous round's finish order, so
    // never discard a newly dealt hand based on stale placement state.
    return adapted;
  }

  if (message.type !== "state") return adapted;

  let tributePublicCount = currentFixed.__tributePublicCount ?? 0;

  // While tribute is pending, every public table entry belongs to the tribute
  // exchange. On the final return-card snapshot pending_tribute becomes null,
  // so capture that final prefix before normal play starts.
  if (message.pending_tribute !== null) {
    tributePublicCount = message.table_plays.length;
  } else if (
    current.pendingTribute !== null &&
    message.last_play.length === 0 &&
    message.table_plays.length > 0
  ) {
    tributePublicCount = message.table_plays.length;
  }

  if (message.table_plays.length === 0 && message.last_play.length === 0) {
    tributePublicCount = 0;
  }

  const normalPlayStarted = message.last_play.length > 0;
  const visiblePlays =
    normalPlayStarted && tributePublicCount > 0
      ? message.table_plays.slice(tributePublicCount)
      : message.table_plays;

  const tablePlays = visiblePlays.map((play) => ({
    ...play,
    cards: sortPlayCards(play.cards, message.level),
  }));

  const clearOwnHand =
    shouldClearOwnHand(adapted.seat, message.finish_order) ||
    message.next_round_phase === "awaiting_shuffle";

  return {
    ...adapted,
    hand: clearOwnHand ? [] : adapted.hand,
    tablePlays,
    __tributePublicCount: tributePublicCount,
  } as RealTestState;
};
