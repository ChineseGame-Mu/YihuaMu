import { findSuggestedIndexes, handCanBeat } from "./GuandanNoBeatHint";
import type { GuandanCard, GuandanRank, GuandanSuit } from "./guandanProtocol";

const suited = (
  rank: GuandanRank,
  suit: GuandanSuit = "Clubs",
): GuandanCard => ({ Suited: { suit, rank } });

describe("Guandan equal-strength plays cannot beat", () => {
  test("does not let an equal-rank pair beat the table pair", () => {
    const hand = [suited("Nine", "Clubs"), suited("Nine", "Diamonds")];
    const current = [suited("Nine", "Hearts"), suited("Nine", "Spades")];

    expect(handCanBeat(hand, current, "Two")).toBe(false);
    expect(findSuggestedIndexes(hand, current, "Two")).toEqual([]);
  });

  test("ignores the attached pair when triple-with-pair main ranks are equal", () => {
    const hand = [
      suited("Nine", "Clubs"),
      suited("Nine", "Diamonds"),
      suited("Nine", "Hearts"),
      suited("Ace", "Clubs"),
      suited("Ace", "Diamonds"),
    ];
    const current = [
      suited("Nine", "Clubs"),
      suited("Nine", "Diamonds"),
      suited("Nine", "Spades"),
      suited("Three", "Clubs"),
      suited("Three", "Diamonds"),
    ];

    expect(handCanBeat(hand, current, "Two")).toBe(false);
    expect(findSuggestedIndexes(hand, current, "Two")).toEqual([]);
  });
});
