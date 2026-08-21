import { findSuggestedIndexes } from "./GuandanNoBeatHint";
import type { GuandanCard, GuandanRank, GuandanSuit } from "./guandanProtocol";

const suited = (
  rank: GuandanRank,
  suit: GuandanSuit = "Clubs",
): GuandanCard => ({ Suited: { suit, rank } });

describe("Guandan bomb economy suggestions", () => {
  test("uses a four-card bomb before a straight flush or six-card bomb", () => {
    const hand = [
      suited("Four", "Clubs"),
      suited("Four", "Diamonds"),
      suited("Four", "Hearts"),
      suited("Four", "Spades"),
      suited("Three", "Hearts"),
      suited("Four", "Hearts"),
      suited("Five", "Hearts"),
      suited("Six", "Hearts"),
      suited("Seven", "Hearts"),
      suited("Eight", "Clubs"),
      suited("Eight", "Diamonds"),
      suited("Eight", "Hearts"),
      suited("Eight", "Spades"),
      suited("Eight", "Clubs"),
      suited("Eight", "Diamonds"),
    ];
    const current = [suited("Ace", "Clubs"), suited("Ace", "Diamonds")];

    expect(findSuggestedIndexes(hand, current, "Two")).toEqual([0, 1, 2, 3]);
  });

  test("uses a straight flush before a six-card bomb against a five-card bomb", () => {
    const hand = [
      suited("Seven", "Hearts"),
      suited("Eight", "Hearts"),
      suited("Nine", "Hearts"),
      suited("Ten", "Hearts"),
      suited("Jack", "Hearts"),
      suited("Six", "Clubs"),
      suited("Six", "Diamonds"),
      suited("Six", "Hearts"),
      suited("Six", "Spades"),
      suited("Six", "Clubs"),
      suited("Six", "Diamonds"),
    ];
    const current = [
      suited("Nine", "Clubs"),
      suited("Nine", "Diamonds"),
      suited("Nine", "Hearts"),
      suited("Nine", "Spades"),
      suited("Nine", "Clubs"),
    ];

    expect(findSuggestedIndexes(hand, current, "Two")).toEqual([0, 1, 2, 3, 4]);
  });
});
