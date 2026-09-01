import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { canHandBeatWithLevel, classifyHand } from "../src/core/hand.js";
import { classifyHandWithLevel } from "../src/core/level-hand.js";

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});

describe("level two straight regression", () => {
  it("accepts 23456 as a straight while 2 remains above A as an ordinary level card", () => {
    const straight = [
      suited("2", "diamonds"),
      suited("3", "diamonds"),
      suited("4", "spades"),
      suited("5", "spades"),
      suited("6", "clubs"),
    ];

    expect(classifyHand(straight)).toEqual({
      kind: "straight",
      size: 5,
      highRank: "6",
    });
    expect(classifyHandWithLevel(straight, "2")).toEqual({
      kind: "straight",
      size: 5,
      highRank: "6",
    });

    const levelTwo = classifyHand([suited("2", "diamonds")]);
    const ace = classifyHand([suited("A", "clubs")]);
    expect(canHandBeatWithLevel(levelTwo, ace, "2")).toBe(true);
  });

  it("keeps JQKA2 invalid instead of wrapping 2 above A", () => {
    expect(
      classifyHandWithLevel(
        [
          suited("J", "clubs"),
          suited("Q", "diamonds"),
          suited("K", "spades"),
          suited("A", "hearts"),
          suited("2", "diamonds"),
        ],
        "2",
      ).kind,
    ).toBe("invalid");
  });
});
