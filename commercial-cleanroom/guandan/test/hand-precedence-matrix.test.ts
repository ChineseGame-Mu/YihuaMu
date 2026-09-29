import { describe, expect, it } from "vitest";
import { type Card, type Rank, type Suit } from "../src/core/cards.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const joker = (size: "small" | "big"): Card => ({ kind: "joker", size });

const classify = (cards: readonly Card[]) => classifyHand(cards);

describe("complete hand classification boundaries", () => {
  it("recognizes the wheel straight A2345 with five high", () => {
    const hand = classify([
      suited("A", "clubs"),
      suited("2", "diamonds"),
      suited("3", "hearts"),
      suited("4", "spades"),
      suited("5", "clubs"),
    ]);
    expect(hand).toEqual({ kind: "straight", size: 5, highRank: "5" });
  });

  it("rejects straights that otherwise contain 2", () => {
    expect(
      classify([
        suited("J", "clubs"),
        suited("Q", "diamonds"),
        suited("K", "hearts"),
        suited("A", "spades"),
        suited("2", "clubs"),
      ]).kind,
    ).toBe("invalid");
  });

  it("distinguishes small and big joker singles", () => {
    expect(classify([joker("small")])).toEqual({
      kind: "single",
      size: 1,
      jokerSize: "small",
    });
    expect(classify([joker("big")])).toEqual({
      kind: "single",
      size: 1,
      jokerSize: "big",
    });
  });

  it("recognizes the four-joker bomb", () => {
    expect(
      classify([joker("small"), joker("small"), joker("big"), joker("big")]),
    ).toEqual({ kind: "joker-bomb", size: 4 });
  });

  it("rejects mixed suited and joker combinations", () => {
    expect(classify([suited("A"), joker("small")]).kind).toBe("invalid");
  });

  it("recognizes four, five, and six-card rank bombs", () => {
    expect(
      classify([
        suited("8", "clubs"),
        suited("8", "diamonds"),
        suited("8", "hearts"),
        suited("8", "spades"),
      ]).kind,
    ).toBe("bomb");
    expect(
      classify([
        suited("9", "clubs"),
        suited("9", "diamonds"),
        suited("9", "hearts"),
        suited("9", "spades"),
        suited("9", "clubs"),
      ]).kind,
    ).toBe("bomb");
    expect(
      classify([
        suited("10", "clubs"),
        suited("10", "diamonds"),
        suited("10", "hearts"),
        suited("10", "spades"),
        suited("10", "clubs"),
        suited("10", "diamonds"),
      ]).kind,
    ).toBe("bomb");
  });
});

describe("complete hand precedence matrix", () => {
  it("orders normal singles including jokers", () => {
    expect(canHandBeat(classify([suited("A")]), classify([suited("K")]))).toBe(
      true,
    );
    expect(
      canHandBeat(classify([joker("small")]), classify([suited("A")])),
    ).toBe(true);
    expect(
      canHandBeat(classify([joker("big")]), classify([joker("small")])),
    ).toBe(true);
  });

  it("requires matching normal hand kind and size", () => {
    const pair = classify([suited("6", "clubs"), suited("6", "diamonds")]);
    const triple = classify([
      suited("7", "clubs"),
      suited("7", "diamonds"),
      suited("7", "hearts"),
    ]);
    expect(canHandBeat(triple, pair)).toBe(false);
  });

  it("compares straights and repeated sequences by their high rank", () => {
    const lowStraight = classify([
      suited("3", "clubs"),
      suited("4", "diamonds"),
      suited("5", "hearts"),
      suited("6", "spades"),
      suited("7", "clubs"),
    ]);
    const highStraight = classify([
      suited("4", "clubs"),
      suited("5", "diamonds"),
      suited("6", "hearts"),
      suited("7", "spades"),
      suited("8", "clubs"),
    ]);
    expect(canHandBeat(highStraight, lowStraight)).toBe(true);

    const lowPairs = classify([
      suited("5", "clubs"),
      suited("5", "diamonds"),
      suited("6", "clubs"),
      suited("6", "diamonds"),
      suited("7", "clubs"),
      suited("7", "diamonds"),
    ]);
    const highPairs = classify([
      suited("6", "clubs"),
      suited("6", "diamonds"),
      suited("7", "clubs"),
      suited("7", "diamonds"),
      suited("8", "clubs"),
      suited("8", "diamonds"),
    ]);
    expect(canHandBeat(highPairs, lowPairs)).toBe(true);
  });

  it("uses Guandan bomb hierarchy across types", () => {
    const fourBomb = classify([
      suited("A", "clubs"),
      suited("A", "diamonds"),
      suited("A", "hearts"),
      suited("A", "spades"),
    ]);
    const fiveBomb = classify([
      suited("3", "clubs"),
      suited("3", "diamonds"),
      suited("3", "hearts"),
      suited("3", "spades"),
      suited("3", "clubs"),
    ]);
    const straightFlush = classify([
      suited("4", "hearts"),
      suited("5", "hearts"),
      suited("6", "hearts"),
      suited("7", "hearts"),
      suited("8", "hearts"),
    ]);
    const sixBomb = classify([
      suited("2", "clubs"),
      suited("2", "diamonds"),
      suited("2", "hearts"),
      suited("2", "spades"),
      suited("2", "clubs"),
      suited("2", "diamonds"),
    ]);
    const jokerBomb = classify([
      joker("small"),
      joker("small"),
      joker("big"),
      joker("big"),
    ]);

    expect(canHandBeat(fiveBomb, fourBomb)).toBe(true);
    expect(canHandBeat(straightFlush, fiveBomb)).toBe(true);
    expect(canHandBeat(sixBomb, straightFlush)).toBe(true);
    expect(canHandBeat(jokerBomb, sixBomb)).toBe(true);
  });

  it("lets any bomb beat a non-bomb but never the reverse", () => {
    const pair = classify([suited("A", "clubs"), suited("A", "diamonds")]);
    const bomb = classify([
      suited("4", "clubs"),
      suited("4", "diamonds"),
      suited("4", "hearts"),
      suited("4", "spades"),
    ]);
    expect(canHandBeat(bomb, pair)).toBe(true);
    expect(canHandBeat(pair, bomb)).toBe(false);
  });
});
