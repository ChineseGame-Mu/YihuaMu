import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { canBeat, classifyHand } from "../src/core/hand.js";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const ranks = (values: readonly Rank[], suit?: Suit): Card[] =>
  values.map((rank, index) =>
    suited(rank, suit ?? (["clubs", "diamonds", "spades", "hearts"][index % 4] as Suit)),
  );

describe("classifyHand", () => {
  it("classifies singles, pairs, triples and bombs", () => {
    expect(classifyHand([suited("A")]).kind).toBe("single");
    expect(classifyHand([suited("3"), suited("3", "hearts")]).kind).toBe("pair");
    expect(
      classifyHand([suited("2"), suited("2", "diamonds"), suited("2", "hearts")])
        .kind,
    ).toBe("triple");
    expect(
      classifyHand([
        suited("A"),
        suited("A", "diamonds"),
        suited("A", "spades"),
        suited("A", "hearts"),
      ]).kind,
    ).toBe("bomb");
  });

  it("recognizes four jokers as the joker bomb", () => {
    const cards: Card[] = [
      { kind: "joker", size: "small" },
      { kind: "joker", size: "small" },
      { kind: "joker", size: "big" },
      { kind: "joker", size: "big" },
    ];
    expect(classifyHand(cards).kind).toBe("joker-bomb");
  });

  it("recognizes a three-with-pair", () => {
    const hand = [
      suited("7"),
      suited("7", "diamonds"),
      suited("7", "hearts"),
      suited("K"),
      suited("K", "spades"),
    ];
    expect(classifyHand(hand)).toMatchObject({ kind: "triple-pair", rank: "7" });
  });

  it("recognizes ordinary straights and A2345", () => {
    expect(classifyHand(ranks(["6", "7", "8", "9", "10"]))).toMatchObject({
      kind: "straight",
      rank: "10",
    });
    expect(classifyHand(ranks(["A", "2", "3", "4", "5"]))).toMatchObject({
      kind: "straight",
      rank: "5",
    });
    expect(classifyHand(ranks(["J", "Q", "K", "A", "2"])).kind).toBe("invalid");
  });

  it("recognizes a straight flush", () => {
    expect(classifyHand(ranks(["8", "9", "10", "J", "Q"], "hearts"))).toMatchObject({
      kind: "straight-flush",
      rank: "Q",
      suit: "hearts",
    });
  });

  it("recognizes wood and steel boards", () => {
    const wood = ranks(["4", "4", "5", "5", "6", "6"]);
    const steel = ranks(["9", "9", "9", "10", "10", "10"]);
    expect(classifyHand(wood)).toMatchObject({ kind: "wood-board", rank: "6" });
    expect(classifyHand(steel)).toMatchObject({ kind: "steel-board", rank: "10" });
  });

  it("rejects malformed groups", () => {
    expect(classifyHand([suited("2"), suited("3")]).kind).toBe("invalid");
    expect(classifyHand(ranks(["3", "3", "4", "4", "6", "6"])).kind).toBe("invalid");
  });
});

describe("canBeat", () => {
  it("compares matching ordinary hand kinds by their deciding rank", () => {
    expect(canBeat(ranks(["7", "8", "9", "10", "J"]), ranks(["6", "7", "8", "9", "10"]))).toBe(true);
    expect(canBeat(ranks(["6", "7", "8", "9", "10"]), ranks(["7", "8", "9", "10", "J"]))).toBe(false);
    expect(canBeat([suited("4"), suited("4", "hearts")], [suited("3"), suited("3", "hearts")])).toBe(true);
  });

  it("does not compare unrelated ordinary hand kinds", () => {
    expect(canBeat(ranks(["3", "4", "5", "6", "7"]), [suited("8")])).toBe(false);
  });

  it("lets bombs beat ordinary hands", () => {
    const bomb = [suited("4"), suited("4", "diamonds"), suited("4", "spades"), suited("4", "hearts")];
    expect(canBeat(bomb, ranks(["6", "7", "8", "9", "10"]))).toBe(true);
  });

  it("uses bomb size before rank", () => {
    const fourA = ranks(["A", "A", "A", "A"]);
    const five3 = ranks(["3", "3", "3", "3", "3"]);
    expect(canBeat(five3, fourA)).toBe(true);
    expect(canBeat(fourA, five3)).toBe(false);
  });

  it("places straight flush between five-card and six-card bombs", () => {
    const straightFlush = ranks(["7", "8", "9", "10", "J"], "spades");
    const fourBomb = ranks(["A", "A", "A", "A"]);
    const fiveBomb = ranks(["3", "3", "3", "3", "3"]);
    const sixBomb = ranks(["2", "2", "2", "2", "2", "2"]);

    expect(canBeat(straightFlush, fourBomb)).toBe(true);
    expect(canBeat(straightFlush, fiveBomb)).toBe(true);
    expect(canBeat(straightFlush, sixBomb)).toBe(false);
    expect(canBeat(sixBomb, straightFlush)).toBe(true);
  });

  it("keeps the four-joker bomb highest", () => {
    const jokerBomb: Card[] = [
      { kind: "joker", size: "small" },
      { kind: "joker", size: "small" },
      { kind: "joker", size: "big" },
      { kind: "joker", size: "big" },
    ];
    const eightBomb = ranks(["A", "A", "A", "A", "A", "A", "A", "A"]);
    expect(canBeat(jokerBomb, eightBomb)).toBe(true);
    expect(canBeat(eightBomb, jokerBomb)).toBe(false);
  });
});
