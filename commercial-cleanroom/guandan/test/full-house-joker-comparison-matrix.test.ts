import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});
const smallJoker: Card = { kind: "joker", size: "small" };
const bigJoker: Card = { kind: "joker", size: "big" };

describe("full-house and joker comparison matrix", () => {
  it("compares full houses by the triple rank", () => {
    const low = classifyHand([
      suited("6"),
      suited("6", "diamonds"),
      suited("6", "hearts"),
      suited("A"),
      suited("A", "spades"),
    ]);
    const high = classifyHand([
      suited("7"),
      suited("7", "diamonds"),
      suited("7", "hearts"),
      suited("3"),
      suited("3", "spades"),
    ]);

    expect(low).toMatchObject({ kind: "full-house", rank: "6" });
    expect(high).toMatchObject({ kind: "full-house", rank: "7" });
    expect(canHandBeat(high, low)).toBe(true);
    expect(canHandBeat(low, high)).toBe(false);
  });

  it("orders suited singles below small joker below big joker", () => {
    const ace = classifyHand([suited("A")]);
    const small = classifyHand([smallJoker]);
    const big = classifyHand([bigJoker]);

    expect(canHandBeat(small, ace)).toBe(true);
    expect(canHandBeat(big, small)).toBe(true);
    expect(canHandBeat(ace, small)).toBe(false);
    expect(canHandBeat(small, big)).toBe(false);
  });

  it("requires a strict increase rather than allowing equal hands to beat", () => {
    const leftPair = classifyHand([suited("9"), suited("9", "diamonds")]);
    const rightPair = classifyHand([
      suited("9", "hearts"),
      suited("9", "spades"),
    ]);
    const leftBomb = classifyHand([
      suited("Q"),
      suited("Q", "diamonds"),
      suited("Q", "hearts"),
      suited("Q", "spades"),
    ]);
    const rightBomb = classifyHand([
      suited("Q"),
      suited("Q", "diamonds"),
      suited("Q", "hearts"),
      suited("Q", "spades"),
    ]);

    expect(canHandBeat(rightPair, leftPair)).toBe(false);
    expect(canHandBeat(rightBomb, leftBomb)).toBe(false);
  });

  it("treats four jokers as the top bomb and mixed joker groups as invalid", () => {
    const jokerBomb = classifyHand([
      smallJoker,
      smallJoker,
      bigJoker,
      bigJoker,
    ]);
    const sixBomb = classifyHand([
      suited("A"),
      suited("A", "diamonds"),
      suited("A", "hearts"),
      suited("A", "spades"),
      suited("A"),
      suited("A", "diamonds"),
    ]);
    const mixed = classifyHand([smallJoker, bigJoker]);

    expect(jokerBomb.kind).toBe("joker-bomb");
    expect(canHandBeat(jokerBomb, sixBomb)).toBe(true);
    expect(mixed.kind).toBe("invalid");
  });
});
