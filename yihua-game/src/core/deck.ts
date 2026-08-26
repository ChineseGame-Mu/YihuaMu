import { RANKS, SUITS, type Card } from "./cards.js";
import { CARDS_PER_PLAYER, type SupportedPlayerCount } from "./table.js";

export interface DeckCard {
  readonly id: string;
  readonly copy: number;
  readonly card: Card;
}

export type RandomSource = () => number;

export const deckCopiesForTable = (
  playerCount: SupportedPlayerCount,
): number => playerCount / 2;

export const createDeck = (
  playerCount: SupportedPlayerCount,
): DeckCard[] => {
  const deck: DeckCard[] = [];
  const copies = deckCopiesForTable(playerCount);

  for (let copy = 0; copy < copies; copy += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          id: `${copy}:${suit}:${rank}`,
          copy,
          card: { kind: "suited", suit, rank },
        });
      }
    }

    deck.push({
      id: `${copy}:joker:small`,
      copy,
      card: { kind: "joker", size: "small" },
    });
    deck.push({
      id: `${copy}:joker:big`,
      copy,
      card: { kind: "joker", size: "big" },
    });
  }

  return deck;
};

export const shuffleDeck = (
  deck: readonly DeckCard[],
  random: RandomSource = Math.random,
): DeckCard[] => {
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex]!,
      shuffled[index]!,
    ];
  }

  return shuffled;
};

export const dealHands = (
  deck: readonly DeckCard[],
  playerCount: SupportedPlayerCount,
): DeckCard[][] => {
  const required = playerCount * CARDS_PER_PLAYER;
  if (deck.length !== required) {
    throw new Error(`deck must contain exactly ${required} cards`);
  }

  const hands = Array.from(
    { length: playerCount },
    () => [] as DeckCard[],
  );

  deck.forEach((card, index) => {
    hands[index % playerCount]!.push(card);
  });

  return hands;
};
