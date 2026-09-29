import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});

describe("hand comparison boundaries", () => {
  it("orders joker singles above suited singles and big joker above small joker", () => {
    const ace = classifyHand([suited("A", "clubs")]);
    const smallJoker = classifyHand([{ kind: "joker", size: "small" }]);
    const bigJoker = classifyHand([{ kind: "joker", size: "big" }]);

    expect(canHandBeat(smallJoker, ace)).toBe(true);
    expect(canHandBeat(bigJoker, smallJoker)).toBe(true);
    expect(canHandBeat(smallJoker, bigJoker)).toBe(false);
  });

  it("orders straight flushes by high rank", () => {
    const nineHigh = classifyHand([
      suited("5", "hearts"),
      suited("6", "hearts"),
      suited("7", "hearts"),
      suited("8", "hearts"),
      suited("9", "hearts"),
    ]);
    const tenHigh = classifyHand([
      suited("6", "spades"),
      suited("7", "spades"),
      suited("8", "spades"),
      suited("9", "spades"),
      suited("10", "spades"),
    ]);

    expect(canHandBeat(tenHigh, nineHigh)).toBe(true);
    expect(canHandBeat(nineHigh, tenHigh)).toBe(false);
  });

  it("keeps a six-card bomb above every straight flush", () => {
    const aceHighStraightFlush = classifyHand([
      suited("10", "diamonds"),
      suited("J", "diamonds"),
      suited("Q", "diamonds"),
      suited("K", "diamonds"),
      suited("A", "diamonds"),
    ]);
    const sixThreeBomb = classifyHand([
      suited("3", "clubs"),
      suited("3", "diamonds"),
      suited("3", "hearts"),
      suited("3", "spades"),
      suited("3", "clubs"),
      suited("3", "diamonds"),
    ]);

    expect(canHandBeat(sixThreeBomb, aceHighStraightFlush)).toBe(true);
    expect(canHandBeat(aceHighStraightFlush, sixThreeBomb)).toBe(false);
  });
});
