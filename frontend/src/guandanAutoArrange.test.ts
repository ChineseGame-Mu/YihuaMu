import { arrangeGuandanHand } from "./guandanAutoArrange";
import type { GuandanCard, GuandanRank, GuandanSuit } from "./guandanProtocol";

const suited = (rank: GuandanRank, suit: GuandanSuit): GuandanCard => ({
  Suited: { rank, suit },
});

describe("automatic Guandan hand arrangement", () => {
  test("mixed joker display grouping preserves individual selection indexes", () => {
    const hand: GuandanCard[] = [
      { Joker: "Big" },
      suited("Three", "Clubs"),
      { Joker: "Small" },
    ];
    const groups = arrangeGuandanHand(hand, "Two");
    expect(groups.find(({ label }) => label === "大小王对子")?.indexes).toEqual([
      2, 0,
    ]);
    expect(groups.flatMap(({ indexes }) => indexes).sort((a, b) => a - b)).toEqual(
      [0, 1, 2],
    );
  });

  test("groups a natural triple with mixed jokers as a legal full house", () => {
    const hand: GuandanCard[] = [
      { Joker: "Big" },
      suited("Eight", "Clubs"),
      suited("Eight", "Diamonds"),
      { Joker: "Small" },
      suited("Eight", "Spades"),
    ];
    const groups = arrangeGuandanHand(hand, "Two");
    expect(groups).toEqual([
      {
        kind: "full-house",
        label: "三带二（8带大小王）",
        indexes: [1, 2, 4, 3, 0],
      },
    ]);
    expect(groups.flatMap(({ indexes }) => indexes).sort((a, b) => a - b)).toEqual(
      [0, 1, 2, 3, 4],
    );
  });

  test("keeps mixed-joker full houses selectable across all arrangement strategies", () => {
    const hand: GuandanCard[] = [
      suited("Eight", "Clubs"),
      { Joker: "Small" },
      suited("Eight", "Diamonds"),
      { Joker: "Big" },
      suited("Eight", "Spades"),
    ];
    for (const strategy of ["balanced", "sequences", "sets"] as const) {
      const groups = arrangeGuandanHand(hand, "Two", strategy);
      expect(groups).toEqual([
        {
          kind: "full-house",
          label: "三带二（8带大小王）",
          indexes: [0, 2, 4, 1, 3],
        },
      ]);
      expect(groups.flatMap(({ indexes }) => indexes).sort((a, b) => a - b)).toEqual(
        [0, 1, 2, 3, 4],
      );
    }
  });

  test("prefers a natural triple over a wildcard-made triple with mixed jokers", () => {
    const hand: GuandanCard[] = [
      suited("Three", "Clubs"),
      suited("Three", "Diamonds"),
      suited("Eight", "Clubs"),
      { Joker: "Small" },
      suited("Eight", "Diamonds"),
      suited("Nine", "Hearts"),
      { Joker: "Big" },
      suited("Eight", "Spades"),
    ];
    for (const strategy of ["balanced", "sequences", "sets"] as const) {
      const groups = arrangeGuandanHand(hand, "Nine", strategy);
      expect(
        groups.some(
          ({ kind, label, indexes }) =>
            kind === "full-house" &&
            label === "三带二（8带大小王）" &&
            [2, 3, 4, 6, 7].every((index) => indexes.includes(index)),
        ),
      ).toBe(true);
      const allIndexes = groups.flatMap(({ indexes }) => indexes);
      expect(allIndexes).toHaveLength(hand.length);
      expect(new Set(allIndexes).size).toBe(hand.length);
      expect([...allIndexes].sort((a, b) => a - b)).toEqual(
        hand.map((_, index) => index),
      );
    }
  });

  test("never duplicates or loses card indexes when a joker pair competes with other groups", () => {
    const hand: GuandanCard[] = [
      suited("Eight", "Clubs"),
      { Joker: "Small" },
      suited("Eight", "Diamonds"),
      suited("Eight", "Spades"),
      { Joker: "Big" },
      suited("Four", "Clubs"),
      suited("Four", "Diamonds"),
      suited("Five", "Clubs"),
      suited("Five", "Spades"),
      suited("Six", "Clubs"),
      suited("Six", "Diamonds"),
    ];
    for (const strategy of ["balanced", "sequences", "sets"] as const) {
      const groups = arrangeGuandanHand(hand, "Two", strategy);
      const allIndexes = groups.flatMap(({ indexes }) => indexes);
      expect(allIndexes).toHaveLength(hand.length);
      expect(new Set(allIndexes).size).toBe(hand.length);
      expect([...allIndexes].sort((a, b) => a - b)).toEqual(
        hand.map((_, index) => index),
      );
      expect(
        groups.some(
          ({ kind, label }) =>
            kind === "full-house" && label === "三带二（8带大小王）",
        ),
      ).toBe(true);
    }
  });

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
    expect(groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "joker-bomb", label: "四王炸" }),
        expect.objectContaining({ kind: "bomb", label: "4张6炸" }),
      ]),
    );
    expect(groups.find(({ kind }) => kind === "bomb")?.indexes).toEqual([
      0, 1, 2, 3,
    ]);
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

  test("offers sequence-first and same-rank-first alternative plans", () => {
    const hand: GuandanCard[] = [
      suited("Three", "Clubs"),
      suited("Three", "Diamonds"),
      suited("Three", "Spades"),
      suited("Four", "Hearts"),
      suited("Five", "Clubs"),
      suited("Six", "Diamonds"),
      suited("Seven", "Spades"),
    ];

    const sequencePlan = arrangeGuandanHand(hand, "Two", "sequences");
    const setPlan = arrangeGuandanHand(hand, "Two", "sets");

    expect(sequencePlan.some(({ kind }) => kind === "straight")).toBe(true);
    expect(setPlan[0]).toMatchObject({ kind: "triple", label: "三张3" });
    for (const plan of [sequencePlan, setPlan]) {
      expect(
        plan.flatMap(({ indexes }) => indexes).sort((a, b) => a - b),
      ).toEqual(hand.map((_, index) => index));
    }
  });

  test("orders completed groups from lower to higher strength left-to-right", () => {
    const hand: GuandanCard[] = [
      suited("King", "Clubs"),
      suited("Three", "Diamonds"),
      { Joker: "Small" },
      suited("Ace", "Hearts"),
      suited("Ten", "Spades"),
      { Joker: "Big" },
    ];

    expect(arrangeGuandanHand(hand, "Two").map(({ label }) => label)).toEqual([
      "单张3",
      "单张10",
      "单张K",
      "单张A",
      "大小王对子",
    ]);
  });

  test("places the current level rank after aces and before jokers", () => {
    const hand: GuandanCard[] = [
      suited("Two", "Diamonds"),
      suited("Three", "Clubs"),
      suited("Ace", "Spades"),
      { Joker: "Small" },
      { Joker: "Big" },
    ];

    expect(arrangeGuandanHand(hand, "Two").map(({ label }) => label)).toEqual([
      "单张3",
      "单张A",
      "单张2",
      "大小王对子",
    ]);
  });

  test("does not invent groups when the level is not yet known", () => {
    const hand: GuandanCard[] = [
      suited("Eight", "Clubs"),
      suited("Eight", "Diamonds"),
      suited("Eight", "Spades"),
      { Joker: "Small" },
      { Joker: "Big" },
    ];
    for (const strategy of ["balanced", "sequences", "sets"] as const) {
      expect(arrangeGuandanHand(hand, null, strategy)).toEqual(
        hand.map((_, index) => ({
          kind: "single",
          label: "单张",
          indexes: [index],
        })),
      );
    }
  });

  test("never mutates the caller's hand or card objects during arrangement", () => {
    const hand: GuandanCard[] = [
      suited("Three", "Clubs"),
      suited("Three", "Diamonds"),
      suited("Three", "Spades"),
      suited("Nine", "Hearts"),
      { Joker: "Small" },
      { Joker: "Big" },
    ];
    const before = JSON.stringify(hand);
    for (const strategy of ["balanced", "sequences", "sets"] as const) {
      const groups = arrangeGuandanHand(hand, "Nine", strategy);
      expect(JSON.stringify(hand)).toBe(before);
      const indexes = groups.flatMap(({ indexes }) => indexes);
      expect(indexes).toHaveLength(hand.length);
      expect(new Set(indexes).size).toBe(hand.length);
    }
  });

  test("empty hands remain empty for every level and arrangement strategy", () => {
    const levels: Array<GuandanRank | null> = [null, "Two", "Nine", "Ace"];
    for (const level of levels) {
      for (const strategy of ["balanced", "sequences", "sets"] as const) {
        expect(arrangeGuandanHand([], level, strategy)).toEqual([]);
      }
    }
  });

  test("supports deeply frozen input cards without modifying them", () => {
    const hand: GuandanCard[] = [
      suited("Eight", "Clubs"),
      suited("Eight", "Diamonds"),
      suited("Eight", "Spades"),
      { Joker: "Small" },
      { Joker: "Big" },
    ];
    hand.forEach((card) => {
      if ("Suited" in card) Object.freeze(card.Suited);
      Object.freeze(card);
    });
    Object.freeze(hand);
    for (const strategy of ["balanced", "sequences", "sets"] as const) {
      const groups = arrangeGuandanHand(hand, "Two", strategy);
      expect(groups).toEqual([
        {
          kind: "full-house",
          label: "三带二（8带大小王）",
          indexes: [0, 1, 2, 3, 4],
        },
      ]);
    }
  });

  test("keeps both physical deck copies distinct when identical cards appear", () => {
    const hand: GuandanCard[] = [
      suited("Six", "Clubs"),
      suited("Six", "Clubs"),
      suited("Six", "Diamonds"),
      suited("Six", "Diamonds"),
      { Joker: "Small" },
      { Joker: "Small" },
      { Joker: "Big" },
      { Joker: "Big" },
    ];
    for (const strategy of ["balanced", "sequences", "sets"] as const) {
      const groups = arrangeGuandanHand(hand, "Two", strategy);
      const indexes = groups.flatMap(({ indexes }) => indexes);
      expect(indexes).toHaveLength(hand.length);
      expect(new Set(indexes).size).toBe(hand.length);
      expect([...indexes].sort((a, b) => a - b)).toEqual(
        hand.map((_, index) => index),
      );
      expect(groups.some(({ kind }) => kind === "joker-bomb")).toBe(true);
    }
  });

  test("returns independent group indexes on repeated arrangement calls", () => {
    const hand: GuandanCard[] = [
      suited("Eight", "Clubs"),
      suited("Eight", "Diamonds"),
      suited("Eight", "Spades"),
      { Joker: "Small" },
      { Joker: "Big" },
    ];
    for (const strategy of ["balanced", "sequences", "sets"] as const) {
      const first = arrangeGuandanHand(hand, "Two", strategy);
      const expected = arrangeGuandanHand(hand, "Two", strategy);
      expect(first).toEqual(expected);
      expect(first).not.toBe(expected);
      expect(first[0].indexes).not.toBe(expected[0].indexes);
      first[0].indexes.reverse();
      expect(arrangeGuandanHand(hand, "Two", strategy)).toEqual(expected);
    }
  });

  test("unknown level never creates speculative combinations from duplicate-deck cards", () => {
    const hand: GuandanCard[] = [
      suited("Nine", "Hearts"),
      suited("Nine", "Hearts"),
      suited("Nine", "Clubs"),
      suited("Nine", "Diamonds"),
      { Joker: "Small" },
      { Joker: "Small" },
      { Joker: "Big" },
      { Joker: "Big" },
    ];
    const original = JSON.stringify(hand);
    for (const strategy of ["balanced", "sequences", "sets"] as const) {
      const groups = arrangeGuandanHand(hand, null, strategy);
      expect(groups).toEqual(
        hand.map((_, index) => ({
          kind: "single",
          label: "单张",
          indexes: [index],
        })),
      );
      expect(JSON.stringify(hand)).toBe(original);
    }
  });

  test("preserves every original card index across seeded four-player deals", () => {
    const ranks: GuandanRank[] = [
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Jack",
      "Queen",
      "King",
      "Ace",
    ];
    const suits: GuandanSuit[] = ["Clubs", "Diamonds", "Spades", "Hearts"];
    const deck: GuandanCard[] = [];
    for (let copy = 0; copy < 2; copy += 1) {
      for (const rank of ranks) {
        for (const suit of suits) deck.push(suited(rank, suit));
      }
      deck.push({ Joker: "Small" }, { Joker: "Big" });
    }
    expect(deck).toHaveLength(108);
    let seed = 20261109;
    const nextRandom = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    for (let deal = 0; deal < 104; deal += 1) {
      const shuffled = [...deck];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(nextRandom() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const level = ranks[deal % ranks.length];
      for (let seat = 0; seat < 4; seat += 1) {
        const hand = shuffled.slice(seat * 27, (seat + 1) * 27);
        const originalHand = JSON.stringify(hand);
        for (const strategy of ["balanced", "sequences", "sets"] as const) {
          const first = arrangeGuandanHand(hand, level, strategy);
          expect(arrangeGuandanHand(hand, level, strategy)).toEqual(first);
          const indexes = first.flatMap((group) => group.indexes);
          expect(JSON.stringify(hand)).toBe(originalHand);
          expect(indexes).toHaveLength(27);
          expect(new Set(indexes).size).toBe(27);
          expect([...indexes].sort((a, b) => a - b)).toEqual(
            hand.map((_, index) => index),
          );
        }
      }
    }
  });
});
