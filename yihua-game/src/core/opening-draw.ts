import {
  determineUniqueOpeningWinner,
  openingDrawStrength,
  type Card,
} from "./cards.js";
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

export interface OpeningDrawSession {
  readonly remainingCards: readonly DeckCard[];
  readonly attempts: readonly OpeningDrawAttempt[];
  readonly winnerSeat: number | null;
}

const ordinaryCards = (deck: readonly DeckCard[]): DeckCard[] =>
  deck.filter(({ card }) => card.kind === "suited");

const cardsOnly = (draw: readonly DeckCard[]): Card[] =>
  draw.map(({ card }) => card);

const seatDrawsFor = (
  cards: readonly DeckCard[],
  seats: readonly number[],
): OpeningSeatDraw[] =>
  cards.map((card, index) => ({ seat: seats[index]!, card }));

const tiedHighestSeats = (attempt: OpeningDrawAttempt): number[] => {
  if (attempt.seatDraws.length === 0) return [];
  const strengths = attempt.seatDraws.map(({ seat, card }) => ({
    seat,
    strength: openingDrawStrength(card.card),
  }));
  const maximum = Math.max(...strengths.map(({ strength }) => strength));
  return strengths
    .filter(({ strength }) => strength === maximum)
    .map(({ seat }) => seat);
};

export const nextOpeningDrawSeats = (
  session: OpeningDrawSession,
  playerCount: SupportedPlayerCount,
): readonly number[] => {
  const previous = session.attempts.at(-1);
  if (previous === undefined) {
    return Array.from({ length: playerCount }, (_, seat) => seat);
  }
  if (previous.winnerSeat !== null) return [];
  return tiedHighestSeats(previous);
};

export const createOpeningDrawSession = (
  deck: readonly DeckCard[],
  random: RandomSource = Math.random,
): OpeningDrawSession => ({
  remainingCards: shuffleDeck(ordinaryCards(deck), random),
  attempts: [],
  winnerSeat: null,
});

export const drawOpeningAttempt = (
  session: OpeningDrawSession,
  playerCount: SupportedPlayerCount,
): OpeningDrawSession => {
  if (session.winnerSeat !== null) {
    throw new Error("opening draw already has a winner");
  }

  const seats = nextOpeningDrawSeats(session, playerCount);
  if (seats.length === 0) {
    throw new Error("opening draw has no eligible seats");
  }
  if (session.remainingCards.length < seats.length) {
    throw new Error("opening draw exhausted before a unique winner was found");
  }

  const cards = session.remainingCards.slice(0, seats.length);
  const localWinner = determineUniqueOpeningWinner(cardsOnly(cards));
  const winnerSeat = localWinner === null ? null : seats[localWinner]!;
  const attempt: OpeningDrawAttempt = {
    cards,
    seatDraws: seatDrawsFor(cards, seats),
    winnerSeat,
  };

  return {
    remainingCards: session.remainingCards.slice(seats.length),
    attempts: [...session.attempts, attempt],
    winnerSeat,
  };
};

export const runOpeningDraw = (
  deck: readonly DeckCard[],
  playerCount: SupportedPlayerCount,
  random: RandomSource = Math.random,
): OpeningDrawResult => {
  let session = createOpeningDrawSession(deck, random);

  while (session.winnerSeat === null) {
    session = drawOpeningAttempt(session, playerCount);
  }

  return { attempts: session.attempts, winnerSeat: session.winnerSeat };
};
