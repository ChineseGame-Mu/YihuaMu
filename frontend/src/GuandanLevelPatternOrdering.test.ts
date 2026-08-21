import { findSuggestedIndexes, handCanBeat } from "./GuandanNoBeatHint";
import type { GuandanCard, GuandanRank, GuandanSuit } from "./guandanProtocol";

const suited = (
  rank: GuandanRank,
  suit: GuandanSuit = "Clubs",
): GuandanCard => ({ Suited: { suit, rank } });

describe("Guandan level-card ordinary pattern ordering", () => {
  test("level pair beats an ordinary ace pair", () => {
    const levelPair = [suited("Six", "Clubs"), suited("Six", "Diamonds")];
    const acePair = [suited("Ace", "Clubs"), suited("Ace", "Diamonds")];

    expect(handCanBeat(levelPair, acePair, "Six")).toBe(true);
    expect(findSuggestedIndexes(levelPair, acePair, "Six")).toEqual([0, 1]);
    expect(handCanBeat(acePair, levelPair, "Six")).toBe(false);
  });

  test("level triple beats an ordinary ace triple", () => {
    const levelTriple = [
      suited("Six", "Clubs"),
      suited("Six", "Diamonds"),
      suited("Six", "Hearts"),
    ];
    const aceTriple = [
      suited("Ace", "Clubs"),
      suited("Ace", "Diamonds"),
      suited("Ace", "Hearts"),
    ];

    expect(handCanBeat(levelTriple, aceTriple, "Six")).toBe(true);
    expect(findSuggestedIndexes(levelTriple, aceTriple, "Six")).toEqual([
      0, 1, 2,
    ]);
    expect(handCanBeat(aceTriple, levelTriple, "Six")).toBe(false);
  });

  test("triple-with-pair compares the triple body with level priority", () => {
    const levelBody = [
      suited("Six", "Clubs"),
      suited("Six", "Diamonds"),
      suited("Six", "Hearts"),
      suited("Three", "Clubs"),
      suited("Three", "Diamonds"),
    ];
    const aceBody = [
      suited("Ace", "Clubs"),
      suited("Ace", "Diamonds"),
      suited("Ace", "Hearts"),
      suited("King", "Clubs"),
      suited("King", "Diamonds"),
    ];

    expect(handCanBeat(levelBody, aceBody, "Six")).toBe(true);
    expect(findSuggestedIndexes(levelBody, aceBody, "Six")).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(handCanBeat(aceBody, levelBody, "Six")).toBe(false);
  });
});
