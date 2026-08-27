import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});

describe("classifyHand", () => {
  it("classifies singles, pairs, triples and bombs", () => {
    expect(classifyHand([suited("A", "clubs")])).toMatchObject({
      kind: "single",
      rank: "A",
    });
    expect(
      classifyHand([suited("3", "clubs"), suited("3", "hearts")]),
    ).toMatchObject({ kind: "pair", rank: "3" });
    expect(
      classifyHand([
        suited("2", "clubs"),
        suited("2", "diamonds"),
        suited("2", "hearts"),
      ]),
    ).toMatchObject({ kind: "triple", rank: "2" });
    expect(
      classifyHand([
        suited("A", "clubs"),
        suited("A", "diamonds"),
        suited("A", "spades"),
        suited("A", "hearts"),
      ]),
    ).toMatchObject({ kind: "bomb", size: 4, rank: "A" });
  });

  it("recognizes a full house by the triple rank", () => {
    expect(
      classifyHand([
        suited("7", "clubs"),
        suited("7", "diamonds"),
        suited("7", "hearts"),
        suited("K", "clubs"),
        suited("K", "spades"),
      ]),
    ).toMatchObject({ kind: "full-house", rank: "7" });
  });

  it("recognizes straights including A2345 and straight flushes", () => {
    expect(
      classifyHand([
        suited("A", "clubs"),
        suited("2", "diamonds"),
        suited("3", "spades"),
        suited("4", "hearts"),
        suited("5", "clubs"),
      ]),
    ).toMatchObject({ kind: "straight", highRank: "5" });

    expect(
      classifyHand([
        suited("10", "hearts"),
        suited("J", "hearts"),
        suited("Q", "hearts"),
        suited("K", "hearts"),
        suited("A", "hearts"),
      ]),
    ).toMatchObject({ kind: "straight-flush", highRank: "A" });
  });

  it("rejects straights and repeated sequences that contain rank 2", () => {
    expect(
      classifyHand([
        suited("J", "clubs"),
        suited("Q", "diamonds"),
        suited("K", "spades"),
        suited("A", "hearts"),
        suited("2", "clubs"),
      ]).kind,
    ).toBe("invalid");

    expect(
      classifyHand([
        suited("K", "clubs"),
        suited("K", "hearts"),
        suited("A", "clubs"),
        suited("A", "diamonds"),
        suited("2", "spades"),
        suited("2", "hearts"),
      ]).kind,
    ).toBe("invalid");
  });

  it("recognizes consecutive pairs and consecutive triples", () => {
    expect(
      classifyHand([
        suited("4", "clubs"),
        suited("4", "hearts"),
        suited("5", "clubs"),
        suited("5", "diamonds"),
        suited("6", "spades"),
        suited("6", "hearts"),
      ]),
    ).toMatchObject({ kind: "consecutive-pairs", highRank: "6" });

    expect(
      classifyHand([
        suited("9", "clubs"),
        suited("9", "diamonds"),
        suited("9", "hearts"),
        suited("10", "clubs"),
        suited("10", "diamonds"),
        suited("10", "spades"),
      ]),
    ).toMatchObject({ kind: "consecutive-triples", highRank: "10" });
  });

  it("recognizes four jokers as a joker bomb", () => {
    const cards: Card[] = [
      { kind: "joker", size: "small" },
      { kind: "joker", size: "small" },
      { kind: "joker", size: "big" },
      { kind: "joker", size: "big" },
    ];
    expect(classifyHand(cards).kind).toBe("joker-bomb");
  });

  it("rejects unmatched groups", () => {
    expect(
      classifyHand([suited("2", "clubs"), suited("3", "clubs")]).kind,
    ).toBe("invalid");
  });
});

describe("canHandBeat", () => {
  it("requires a strictly higher hand of the same ordinary kind", () => {
    const pair8 = classifyHand([suited("8", "clubs"), suited("8", "hearts")]);
    const pair9 = classifyHand([suited("9", "clubs"), suited("9", "hearts")]);
    const triple9 = classifyHand([
      suited("9", "clubs"),
      suited("9", "diamonds"),
      suited("9", "hearts"),
    ]);

    expect(canHandBeat(pair9, pair8)).toBe(true);
    expect(canHandBeat(pair8, pair8)).toBe(false);
    expect(canHandBeat(triple9, pair8)).toBe(false);
  });

  it("orders ordinary sequence hands by their high rank", () => {
    const straight9 = classifyHand([
      suited("5", "clubs"),
      suited("6", "diamonds"),
      suited("7", "spades"),
      suited("8", "hearts"),
      suited("9", "clubs"),
    ]);
    const straight10 = classifyHand([
      suited("6", "clubs"),
      suited("7", "diamonds"),
      suited("8", "spades"),
      suited("9", "hearts"),
      suited("10", "clubs"),
    ]);
    const pairs6 = classifyHand([
      suited("4", "clubs"),
      suited("4", "hearts"),
      suited("5", "clubs"),
      suited("5", "diamonds"),
      suited("6", "spades"),
      suited("6", "hearts"),
    ]);
    const pairs7 = classifyHand([
      suited("5", "clubs"),
      suited("5", "hearts"),
      suited("6", "clubs"),
      suited("6", "diamonds"),
      suited("7", "spades"),
      suited("7", "hearts"),
    ]);

    expect(canHandBeat(straight10, straight9)).toBe(true);
    expect(canHandBeat(straight9, straight10)).toBe(false);
    expect(canHandBeat(pairs7, pairs6)).toBe(true);
  });

  it("orders bombs by the clean-room bomb hierarchy", () => {
    const fourBomb = classifyHand([
      suited("A", "clubs"),
      suited("A", "diamonds"),
      suited("A", "hearts"),
      suited("A", "spades"),
    ]);
    const fiveBomb = classifyHand([
      suited("3", "clubs"),
      suited("3", "diamonds"),
      suited("3", "hearts"),
      suited("3", "spades"),
      suited("3", "clubs"),
    ]);
    const straightFlush = classifyHand([
      suited("5", "hearts"),
      suited("6", "hearts"),
      suited("7", "hearts"),
      suited("8", "hearts"),
      suited("9", "hearts"),
    ]);
    const sixBomb = classifyHand([
      suited("4", "clubs"),
      suited("4", "diamonds"),
      suited("4", "hearts"),
      suited("4", "spades"),
      suited("4", "clubs"),
      suited("4", "diamonds"),
    ]);
    const jokerBomb = classifyHand([
      { kind: "joker", size: "small" },
      { kind: "joker", size: "small" },
      { kind: "joker", size: "big" },
      { kind: "joker", size: "big" },
    ]);

    expect(canHandBeat(fiveBomb, fourBomb)).toBe(true);
    expect(canHandBeat(straightFlush, fiveBomb)).toBe(true);
    expect(canHandBeat(sixBomb, straightFlush)).toBe(true);
    expect(canHandBeat(jokerBomb, sixBomb)).toBe(true);
  });
});
