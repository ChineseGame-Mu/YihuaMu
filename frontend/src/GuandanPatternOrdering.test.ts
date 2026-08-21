import { findSuggestedIndexes, handCanBeat } from "./GuandanNoBeatHint";
import type { GuandanCard, GuandanRank, GuandanSuit } from "./guandanProtocol";

const suited = (
  rank: GuandanRank,
  suit: GuandanSuit = "Clubs",
): GuandanCard => ({ Suited: { suit, rank } });

describe("Guandan ordinary pattern ordering", () => {
  test("compares triples by their rank", () => {
    const hand = [
      suited("Ten", "Clubs"),
      suited("Ten", "Diamonds"),
      suited("Ten", "Hearts"),
    ];
    const current = [
      suited("Nine", "Clubs"),
      suited("Nine", "Diamonds"),
      suited("Nine", "Hearts"),
    ];

    expect(handCanBeat(hand, current, "Two")).toBe(true);
    expect(findSuggestedIndexes(hand, current, "Two")).toEqual([0, 1, 2]);
    expect(handCanBeat(current, hand, "Two")).toBe(false);
  });

  test("compares triple-with-pair plays by the triple rank", () => {
    const hand = [
      suited("Ten", "Clubs"),
      suited("Ten", "Diamonds"),
      suited("Ten", "Hearts"),
      suited("Three", "Clubs"),
      suited("Three", "Diamonds"),
    ];
    const current = [
      suited("Nine", "Clubs"),
      suited("Nine", "Diamonds"),
      suited("Nine", "Hearts"),
      suited("Ace", "Clubs"),
      suited("Ace", "Diamonds"),
    ];

    expect(handCanBeat(hand, current, "Two")).toBe(true);
    expect(findSuggestedIndexes(hand, current, "Two")).toEqual([0, 1, 2, 3, 4]);
    expect(handCanBeat(current, hand, "Two")).toBe(false);
  });

  test("compares consecutive pairs by their high rank", () => {
    const hand = [
      suited("Seven", "Clubs"),
      suited("Seven", "Diamonds"),
      suited("Eight", "Clubs"),
      suited("Eight", "Diamonds"),
      suited("Nine", "Clubs"),
      suited("Nine", "Diamonds"),
    ];
    const current = [
      suited("Six", "Clubs"),
      suited("Six", "Diamonds"),
      suited("Seven", "Hearts"),
      suited("Seven", "Spades"),
      suited("Eight", "Hearts"),
      suited("Eight", "Spades"),
    ];

    expect(handCanBeat(hand, current, "Two")).toBe(true);
    expect(findSuggestedIndexes(hand, current, "Two")).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
    expect(handCanBeat(current, hand, "Two")).toBe(false);
  });

  test("compares straights by their high card", () => {
    const hand = [
      suited("Seven", "Clubs"),
      suited("Eight", "Diamonds"),
      suited("Nine", "Hearts"),
      suited("Ten", "Spades"),
      suited("Jack", "Clubs"),
    ];
    const current = [
      suited("Six", "Clubs"),
      suited("Seven", "Diamonds"),
      suited("Eight", "Hearts"),
      suited("Nine", "Spades"),
      suited("Ten", "Clubs"),
    ];

    expect(handCanBeat(hand, current, "Two")).toBe(true);
    expect(findSuggestedIndexes(hand, current, "Two")).toEqual([0, 1, 2, 3, 4]);
    expect(handCanBeat(current, hand, "Two")).toBe(false);
  });

  test("compares consecutive triples by their high triple", () => {
    const hand = [
      suited("Nine", "Clubs"),
      suited("Nine", "Diamonds"),
      suited("Nine", "Hearts"),
      suited("Ten", "Clubs"),
      suited("Ten", "Diamonds"),
      suited("Ten", "Hearts"),
    ];
    const current = [
      suited("Eight", "Clubs"),
      suited("Eight", "Diamonds"),
      suited("Eight", "Hearts"),
      suited("Nine", "Clubs"),
      suited("Nine", "Diamonds"),
      suited("Nine", "Hearts"),
    ];

    expect(handCanBeat(hand, current, "Two")).toBe(true);
    expect(findSuggestedIndexes(hand, current, "Two")).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
    expect(handCanBeat(current, hand, "Two")).toBe(false);
  });

  test("does not compare different ordinary patterns even with the same card count", () => {
    const straight = [
      suited("Seven", "Clubs"),
      suited("Eight", "Diamonds"),
      suited("Nine", "Hearts"),
      suited("Ten", "Spades"),
      suited("Jack", "Clubs"),
    ];
    const tripleWithPair = [
      suited("Nine", "Clubs"),
      suited("Nine", "Diamonds"),
      suited("Nine", "Hearts"),
      suited("Ace", "Clubs"),
      suited("Ace", "Diamonds"),
    ];

    expect(handCanBeat(straight, tripleWithPair, "Two")).toBe(false);
    expect(findSuggestedIndexes(straight, tripleWithPair, "Two")).toEqual([]);
    expect(handCanBeat(tripleWithPair, straight, "Two")).toBe(false);
    expect(findSuggestedIndexes(tripleWithPair, straight, "Two")).toEqual([]);
  });
});
