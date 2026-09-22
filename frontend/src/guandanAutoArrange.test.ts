import { arrangeGuandanHand } from "./guandanAutoArrange";
import type { GuandanCard, GuandanRank, GuandanSuit } from "./guandanProtocol";

const suited = (rank: GuandanRank, suit: GuandanSuit): GuandanCard => ({
  Suited: { rank, suit },
});

describe("automatic Guandan hand arrangement", () => {
  test("groups all requested compound patterns", () => {
    const hand: GuandanCard[] = [
      suited("Ten", "Clubs"),
      suited("Jack", "Clubs"),
      suited("Queen", "Clubs"),
      suited("King", "Clubs"),
      suited("Ace", "Clubs"),
      suited("Three", "Clubs"),
      suited("Three", "Diamonds"),
      suited("Three", "Spades"),
      suited("Four", "Clubs"),
      suited("Four", "Diamonds"),
      suited("Four", "Spades"),
      suited("Six", "Clubs"),
      suited("Six", "Diamonds"),
      suited("Seven", "Hearts"),
      suited("Seven", "Spades"),
      suited("Eight", "Clubs"),
      suited("Eight", "Diamonds"),
    ];

    const groups = arrangeGuandanHand(hand, "Two");
    expect(groups.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining([
        "straight-flush",
        "consecutive-triples",
        "consecutive-pairs",
      ]),
    );
    expect(
      groups.flatMap(({ indexes }) => indexes).sort((a, b) => a - b),
    ).toEqual(hand.map((_, index) => index));
  });

  test("protects natural and four-joker bombs from sequence grouping", () => {
    const hand: GuandanCard[] = [
      suited("Six", "Clubs"),
      suited("Six", "Diamonds"),
      suited("Six", "Hearts"),
      suited("Six", "Spades"),
      { Joker: "Small" },
      { Joker: "Small" },
      { Joker: "Big" },
      { Joker: "Big" },
      suited("Three", "Clubs"),
      suited("Four", "Diamonds"),
      suited("Five", "Spades"),
      suited("Seven", "Clubs"),
    ];

    const groups = arrangeGuandanHand(hand, "Two");
    expect(groups[0]).toMatchObject({ kind: "joker-bomb", label: "四王炸" });
    expect(groups[1]).toMatchObject({ kind: "bomb", label: "4张6炸" });
    expect(groups[1].indexes).toEqual([0, 1, 2, 3]);
  });

  test("uses a heart level card as wildcard without using a joker", () => {
    const hand: GuandanCard[] = [
      suited("Three", "Clubs"),
      suited("Four", "Clubs"),
      suited("Five", "Clubs"),
      suited("Seven", "Clubs"),
      suited("Nine", "Hearts"),
      { Joker: "Small" },
    ];

    const groups = arrangeGuandanHand(hand, "Nine");
    const straightFlush = groups.find(({ kind }) => kind === "straight-flush");
    expect(straightFlush?.indexes).toEqual(
      expect.arrayContaining([0, 1, 2, 3, 4]),
    );
    expect(straightFlush?.indexes).not.toContain(5);
  });

  test("combines two heart level wildcards with a natural pair as a bomb", () => {
    const hand: GuandanCard[] = [
      suited("Queen", "Clubs"),
      suited("Queen", "Diamonds"),
      suited("Nine", "Hearts"),
      suited("Nine", "Hearts"),
    ];

    expect(arrangeGuandanHand(hand, "Nine")).toEqual([
      { kind: "bomb", label: "4张Q炸", indexes: [0, 1, 2, 3] },
    ]);
  });
});
