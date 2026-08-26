import { openingDrawStrength } from "./cards.js";
import { shuffleDeck, type DeckCard, type RandomSource } from "./deck.js";
import type { SupportedPlayerCount } from "./table.js";

export interface OpeningDrawAttempt {
  readonly cards: readonly DeckCard[];
  readonly winnerSeat: number | null;
}

export interface OpeningDrawResult {
  readonly attempts: readonly OpeningDrawAttempt[];
  readonly winnerSeat: number;
}

const ordinaryCards = (deck: readonly DeckCard[]): DeckCard[] =>
  deck.filter(({ card }) => card.kind === "suited");

const uniqueWinner = (cards: readonly DeckCard[]): number | null => {
  let winnerSeat = 0;
  let maximum = openingDrawStrength(cards[0]!.card);
  let tied = false;

  for (let seat = 1; seat < cards.length; seat += 1) {
    const strength = openingDrawStrength(cards[seat]!.card);
    if (strength > maximum) {
      maximum = strength;
      winnerSeat = seat;
      tied = false;
    } else if (strength === maximum) {
      tied = true;
    }
  }

  return tied ? null : winnerSeat;
};

export const runOpeningDraw = (
  deck: readonly DeckCard[],
  playerCount: SupportedPlayerCount,
  random: RandomSource = Math.random,
): OpeningDrawResult => {
  const pool = shuffleDeck(ordinaryCards(deck), random);
  const attempts: OpeningDrawAttempt[] = [];

  for (
    let offset = 0;
    offset + playerCount <= pool.length;
    offset += playerCount
  ) {
    const cards = pool.slice(offset, offset + playerCount);
    const winnerSeat = uniqueWinner(cards);
    attempts.push({ cards, winnerSeat });

    if (winnerSeat !== null) return { attempts, winnerSeat };
  }

  throw new Error("opening draw exhausted before a unique winner was found");
};
