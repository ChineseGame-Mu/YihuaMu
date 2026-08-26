import type { Card, Rank } from "./cards.js";

export type HandKind = "single" | "pair" | "triple" | "bomb" | "joker-bomb" | "invalid";

export interface ClassifiedHand {
  readonly kind: HandKind;
  readonly size: number;
  readonly rank?: Rank;
}

const sameSuitedRank = (cards: readonly Card[]): Rank | null => {
  if (cards.length === 0 || cards[0]!.kind !== "suited") return null;
  const rank = cards[0]!.rank;
  return cards.every((card) => card.kind === "suited" && card.rank === rank)
    ? rank
    : null;
};

export const classifyHand = (cards: readonly Card[]): ClassifiedHand => {
  if (cards.length === 1) return { kind: "single", size: 1 };

  if (
    cards.length === 4 &&
    cards.every((card) => card.kind === "joker")
  ) {
    return { kind: "joker-bomb", size: 4 };
  }

  const rank = sameSuitedRank(cards);
  if (rank === null) return { kind: "invalid", size: cards.length };

  if (cards.length === 2) return { kind: "pair", size: 2, rank };
  if (cards.length === 3) return { kind: "triple", size: 3, rank };
  if (cards.length >= 4) return { kind: "bomb", size: cards.length, rank };

  return { kind: "invalid", size: cards.length };
};
