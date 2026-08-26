export const SUITS = ["clubs", "diamonds", "spades", "hearts"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
] as const;
export type Rank = (typeof RANKS)[number];

export type Card =
  | { readonly kind: "suited"; readonly suit: Suit; readonly rank: Rank }
  | { readonly kind: "joker"; readonly size: "small" | "big" };

const rankStrength = (rank: Rank): number => RANKS.indexOf(rank);
const suitStrength = (suit: Suit): number => SUITS.indexOf(suit);

export const openingDrawStrength = (card: Card): number => {
  if (card.kind === "joker") {
    throw new Error("jokers are not valid opening-draw cards");
  }
  return rankStrength(card.rank) * 10 + suitStrength(card.suit);
};

export const determineUniqueOpeningWinner = (
  draw: readonly Card[],
): number | null => {
  if (draw.length === 0) return null;
  const strengths = draw.map(openingDrawStrength);
  const maximum = Math.max(...strengths);
  const winners = strengths
    .map((strength, seat) => ({ strength, seat }))
    .filter(({ strength }) => strength === maximum);
  return winners.length === 1 ? winners[0]!.seat : null;
};
