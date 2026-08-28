import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});
const joker = (size: "small" | "big"): Card => ({ kind: "joker", size });

const hand = (...cards: Card[]) => classifyHand(cards);

describe("hand comparison boundary matrix", () => {
  it("orders suited ranks and jokers for singles", () => {
    const two = hand(suited("2", "clubs"));
    const small = hand(joker("small"));
    const big = hand(joker("big"));
    expect(canHandBeat(small, two)).toBe(true);
    expect(canHandBeat(big, small)).toBe(true);
    expect(canHandBeat(small, big)).toBe(false);
  });

  it("keeps A2345 below 23456-free ordinary straights and rejects 2 in other straights", () => {
    const wheel = hand(
      suited("A", "clubs"),
      suited("2", "diamonds"),
      suited("3", "hearts"),
      suited("4", "spades"),
      suited("5", "clubs"),
    );
    const sixHigh = hand(
      suited("2", "clubs"),
      suited("3", "diamonds"),
      suited("4", "hearts"),
      suited("5", "spades"),
      suited("6", "clubs"),
    );
    const sixHighWithoutTwo = hand(
      suited("3", "clubs"),
      suited("4", "diamonds"),
      suited("5", "hearts"),
      suited("6", "spades"),
      suited("7", "clubs"),
    );
    expect(wheel).toMatchObject({ kind: "straight", highRank: "5" });
    expect(sixHigh.kind).toBe("invalid");
    expect(canHandBeat(sixHighWithoutTwo, wheel)).toBe(true);
  });

  it("requires ordinary hands to match both kind and size", () => {
    const pairA = hand(suited("A", "clubs"), suited("A", "hearts"));
    const triple3 = hand(
      suited("3", "clubs"),
      suited("3", "diamonds"),
      suited("3", "hearts"),
    );
    const fullHouse3 = hand(
      suited("3", "clubs"),
      suited("3", "diamonds"),
      suited("3", "hearts"),
      suited("A", "clubs"),
      suited("A", "hearts"),
    );
    expect(canHandBeat(triple3, pairA)).toBe(false);
    expect(canHandBeat(fullHouse3, pairA)).toBe(false);
  });

  it("lets every bomb beat ordinary hands but never the reverse", () => {
    const ordinary = hand(suited("A", "clubs"), suited("A", "hearts"));
    const bomb = hand(
      suited("3", "clubs"),
      suited("3", "diamonds"),
      suited("3", "hearts"),
      suited("3", "spades"),
    );
    expect(canHandBeat(bomb, ordinary)).toBe(true);
    expect(canHandBeat(ordinary, bomb)).toBe(false);
  });

  it("locks the complete bomb tier boundaries", () => {
    const fourA = hand(
      suited("A", "clubs"),
      suited("A", "diamonds"),
      suited("A", "hearts"),
      suited("A", "spades"),
    );
    const five3 = hand(
      suited("3", "clubs"),
      suited("3", "diamonds"),
      suited("3", "hearts"),
      suited("3", "spades"),
      suited("3", "clubs"),
    );
    const straightFlush = hand(
      suited("5", "hearts"),
      suited("6", "hearts"),
      suited("7", "hearts"),
      suited("8", "hearts"),
      suited("9", "hearts"),
    );
    const six3 = hand(
      suited("3", "clubs"),
      suited("3", "diamonds"),
      suited("3", "hearts"),
      suited("3", "spades"),
      suited("3", "clubs"),
      suited("3", "diamonds"),
    );
    const jokerBomb = hand(
      joker("small"),
      joker("small"),
      joker("big"),
      joker("big"),
    );
    expect(canHandBeat(five3, fourA)).toBe(true);
    expect(canHandBeat(straightFlush, five3)).toBe(true);
    expect(canHandBeat(six3, straightFlush)).toBe(true);
    expect(canHandBeat(jokerBomb, six3)).toBe(true);
    expect(canHandBeat(six3, jokerBomb)).toBe(false);
  });

  it("orders bombs inside the same tier by rank and larger 6+ bombs by size first", () => {
    const five3 = hand(
      suited("3", "clubs"),
      suited("3", "diamonds"),
      suited("3", "hearts"),
      suited("3", "spades"),
      suited("3", "clubs"),
    );
    const five4 = hand(
      suited("4", "clubs"),
      suited("4", "diamonds"),
      suited("4", "hearts"),
      suited("4", "spades"),
      suited("4", "clubs"),
    );
    const sixA = hand(
      suited("A", "clubs"),
      suited("A", "diamonds"),
      suited("A", "hearts"),
      suited("A", "spades"),
      suited("A", "clubs"),
      suited("A", "diamonds"),
    );
    const seven3 = hand(
      suited("3", "clubs"),
      suited("3", "diamonds"),
      suited("3", "hearts"),
      suited("3", "spades"),
      suited("3", "clubs"),
      suited("3", "diamonds"),
      suited("3", "hearts"),
    );

    expect(canHandBeat(five4, five3)).toBe(true);
    expect(canHandBeat(five3, five4)).toBe(false);
    expect(canHandBeat(five3, five3)).toBe(false);
    expect(canHandBeat(seven3, sixA)).toBe(true);
    expect(canHandBeat(sixA, seven3)).toBe(false);
  });

  it("orders straight flushes by high rank and rejects equal strength", () => {
    const sevenHigh = hand(
      suited("3", "hearts"),
      suited("4", "hearts"),
      suited("5", "hearts"),
      suited("6", "hearts"),
      suited("7", "hearts"),
    );
    const eightHigh = hand(
      suited("4", "spades"),
      suited("5", "spades"),
      suited("6", "spades"),
      suited("7", "spades"),
      suited("8", "spades"),
    );

    expect(canHandBeat(eightHigh, sevenHigh)).toBe(true);
    expect(canHandBeat(sevenHigh, eightHigh)).toBe(false);
    expect(canHandBeat(sevenHigh, sevenHigh)).toBe(false);
  });
});
