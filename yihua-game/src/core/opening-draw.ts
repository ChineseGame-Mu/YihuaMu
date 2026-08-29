import { determineUniqueOpeningWinner, type Card } from "./cards.js";
import { shuffleDeck, type DeckCard, type RandomSource } from "./deck.js";
import type { SupportedPlayerCount } from "./table.js";

export interface OpeningSeatDraw {
  readonly seat: number;
  readonly card: DeckCard;
}

export interface OpeningDrawAttempt {
  readonly cards: readonly DeckCard[];
  readonly seatDraws: readonly OpeningSeatDraw[];
  readonly winnerSeat: number | null;
}

export interface OpeningDrawResult {
  readonly attempts: readonly OpeningDrawAttempt[];
  readonly winnerSeat: number;
}

const ordinaryCards = (deck: readonly DeckCard[]): DeckCard[] =>
  deck.filter(({ card }) => card.kind === "suited");

const cardsOnly = (draw: readonly DeckCard[]): Card[] =>
  draw.map(({ card }) => card);

const seatDrawsFor = (cards: readonly DeckCard[]): OpeningSeatDraw[] =>
  cards.map((card, seat) => ({ seat, card }));

export const runOpeningDraw = (
  deck: readonly DeckCard[],
  playerCount: SupportedPlayerCount,
  random: RandomSource = Math.random,
): OpeningDrawResult => {
  const pool = shuffleDeck(ordinaryCards(deck), random);
  const attempts: OpeningDrawAttempt[] = [];
  let offset = 0;

  while (offset + playerCount <= pool.length) {
    const cards = pool.slice(offset, offset + playerCount);
    offset += playerCount;
    const winnerSeat = determineUniqueOpeningWinner(cardsOnly(cards));
    attempts.push({ cards, seatDraws: seatDrawsFor(cards), winnerSeat });

    if (winnerSeat !== null) {
      return { attempts, winnerSeat };
    }
  }

  throw new Error("opening draw exhausted before a unique winner was found");
};
