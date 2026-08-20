import {
  describeSuggestedCards,
  findSuggestedIndexes,
} from "./GuandanNoBeatHint";
import type { GuandanCard, GuandanRank, GuandanSuit } from "./guandanProtocol";

const suited = (
  rank: GuandanRank,
  suit: GuandanSuit = "Clubs",
): GuandanCard => ({ Suited: { suit, rank } });

const joker = (value: "Small" | "Big"): GuandanCard => ({ Joker: value });

describe("Guandan play suggestion strategy", () => {
  test("uses the smallest same-pattern play that beats the table", () => {
    const hand = [
      suited("Nine", "Clubs"),
      suited("Nine", "Diamonds"),
      suited("Jack", "Clubs"),
      suited("Jack", "Diamonds"),
    ];
    const current = [suited("Eight", "Clubs"), suited("Eight", "Diamonds")];

    expect(findSuggestedIndexes(hand, current, "Two")).toEqual([0, 1]);
  });

  test("does not break a bomb when another ordinary card can beat", () => {
    const hand = [
      suited("Eight", "Clubs"),
      suited("Eight", "Diamonds"),
      suited("Eight", "Hearts"),
      suited("Eight", "Spades"),
      suited("Nine", "Clubs"),
    ];

    expect(findSuggestedIndexes(hand, [suited("Seven")], "Two")).toEqual([4]);
  });

  test("preserves the level card when a non-level card can beat", () => {
    const hand = [suited("Ten"), suited("Jack")];

    expect(findSuggestedIndexes(hand, [suited("Nine")], "Ten")).toEqual([1]);
  });

  test("uses the smallest bomb only when no ordinary play can beat", () => {
    const hand = [
      suited("Four", "Clubs"),
      suited("Four", "Diamonds"),
      suited("Four", "Hearts"),
      suited("Four", "Spades"),
      suited("Six", "Clubs"),
      suited("Six", "Diamonds"),
      suited("Six", "Hearts"),
      suited("Six", "Spades"),
    ];
    const current = [suited("Ace", "Clubs"), suited("Ace", "Diamonds")];

    expect(findSuggestedIndexes(hand, current, "Two")).toEqual([0, 1, 2, 3]);
  });
});

describe("Guandan suggestion descriptions", () => {
  test("describes a pair", () => {
    expect(
      describeSuggestedCards([
        suited("Nine", "Clubs"),
        suited("Nine", "Diamonds"),
      ]),
    ).toBe("对9");
  });

  test("describes a straight by its high card", () => {
    expect(
      describeSuggestedCards([
        suited("Seven", "Clubs"),
        suited("Eight", "Diamonds"),
        suited("Nine", "Hearts"),
        suited("Ten", "Spades"),
        suited("Jack", "Clubs"),
      ]),
    ).toBe("顺子（到J）");
  });

  test("describes a four-card bomb", () => {
    expect(
      describeSuggestedCards([
        suited("Four", "Clubs"),
        suited("Four", "Diamonds"),
        suited("Four", "Hearts"),
        suited("Four", "Spades"),
      ]),
    ).toBe("4炸4");
  });

  test("describes a joker bomb", () => {
    expect(
      describeSuggestedCards([
        joker("Small"),
        joker("Small"),
        joker("Big"),
        joker("Big"),
      ]),
    ).toBe("王炸");
  });
});

describe("Guandan suggestion interaction contract", () => {
  test("keeps suggested selection and description in sync", () => {
    const hand = [
      suited("Nine", "Clubs"),
      suited("Nine", "Diamonds"),
      suited("Jack", "Clubs"),
      suited("Jack", "Diamonds"),
    ];
    const current = [suited("Eight", "Clubs"), suited("Eight", "Diamonds")];

    const indexes = findSuggestedIndexes(hand, current, "Two");
    const suggestedCards = indexes.map((index) => hand[index]);

    expect(indexes).toEqual([0, 1]);
    expect(describeSuggestedCards(suggestedCards)).toBe("对9");
  });
});
