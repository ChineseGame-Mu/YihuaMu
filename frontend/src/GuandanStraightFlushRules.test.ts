import { findSuggestedIndexes, handCanBeat } from "./GuandanNoBeatHint";
import type { GuandanCard, GuandanRank, GuandanSuit } from "./guandanProtocol";

const suited = (rank: GuandanRank, suit: GuandanSuit): GuandanCard => ({
  Suited: { suit, rank },
});

const straightFlush = (
  ranks: GuandanRank[],
  suit: GuandanSuit,
): GuandanCard[] => ranks.map((rank) => suited(rank, suit));

describe("Guandan straight-flush boundaries", () => {
  test("treats A-2-3-4-5 as the lowest straight flush", () => {
    const current = straightFlush(
      ["Ace", "Two", "Three", "Four", "Five"],
      "Hearts",
    );
    const hand = straightFlush(
      ["Two", "Three", "Four", "Five", "Six"],
      "Spades",
    );

    expect(handCanBeat(hand, current, "Nine")).toBe(true);
    expect(findSuggestedIndexes(hand, current, "Nine")).toEqual([
      0, 1, 2, 3, 4,
    ]);
  });

  test("treats 10-J-Q-K-A as the highest straight flush", () => {
    const current = straightFlush(
      ["Ten", "Jack", "Queen", "King", "Ace"],
      "Hearts",
    );
    const hand = straightFlush(
      ["Nine", "Ten", "Jack", "Queen", "King"],
      "Spades",
    );

    expect(handCanBeat(hand, current, "Nine")).toBe(false);
    expect(findSuggestedIndexes(hand, current, "Nine")).toEqual([]);
  });

  test("does not rank suits when straight flushes have equal ranks", () => {
    const current = straightFlush(
      ["Ten", "Jack", "Queen", "King", "Ace"],
      "Clubs",
    );
    const hand = straightFlush(
      ["Ten", "Jack", "Queen", "King", "Ace"],
      "Hearts",
    );

    expect(handCanBeat(hand, current, "Nine")).toBe(false);
    expect(findSuggestedIndexes(hand, current, "Nine")).toEqual([]);
  });
});
