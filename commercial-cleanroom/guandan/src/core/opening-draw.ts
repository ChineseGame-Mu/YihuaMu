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

export interface OpeningDrawSession {
  readonly remainingCards: readonly DeckCard[];
  readonly attempts: readonly OpeningDrawAttempt[];
  readonly winnerSeat: number | null;
}

const ordinaryCards = (deck: readonly DeckCard[]): DeckCard[] =>
  deck.filter(({ card }) => card.kind === "suited");

const cardsOnly = (draw: readonly DeckCard[]): Card[] =>
  draw.map(({ card }) => card);

const seatDrawsFor = (cards: readonly DeckCard[]): OpeningSeatDraw[] =>
  cards.map((card, seat) => ({ seat, card }));

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
  if (session.remainingCards.length < playerCount) {
    throw new Error("opening draw exhausted before a unique winner was found");
  }

  const cards = session.remainingCards.slice(0, playerCount);
  const winnerSeat = determineUniqueOpeningWinner(cardsOnly(cards));
  const attempt: OpeningDrawAttempt = {
    cards,
    seatDraws: seatDrawsFor(cards),
    winnerSeat,
  };

  return {
    remainingCards: session.remainingCards.slice(playerCount),
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
