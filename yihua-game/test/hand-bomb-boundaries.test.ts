import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});

const bomb = (rank: Rank, count: number): Card[] =>
  Array.from({ length: count }, (_, index) =>
    suited(rank, (["clubs", "diamonds", "spades", "hearts"] as const)[index % 4]!),
  );

const straightFlush = (ranks: readonly Rank[]): Card[] =>
  ranks.map((rank) => suited(rank, "spades"));

const jokerBomb: Card[] = [
  { kind: "joker", size: "small" },
  { kind: "joker", size: "small" },
  { kind: "joker", size: "big" },
  { kind: "joker", size: "big" },
];

describe("bomb comparison boundaries", () => {
  it("lets any four-card bomb beat a normal non-bomb hand", () => {
    const fourBomb = classifyHand(bomb("3", 4));
    const pairA = classifyHand([suited("A", "clubs"), suited("A", "hearts")]);

    expect(fourBomb.kind).toBe("bomb");
    expect(canHandBeat(fourBomb, pairA)).toBe(true);
    expect(canHandBeat(pairA, fourBomb)).toBe(false);
  });

  it("orders equal-length bombs by rank", () => {
    const bomb8 = classifyHand(bomb("8", 4));
    const bomb9 = classifyHand(bomb("9", 4));

    expect(canHandBeat(bomb9, bomb8)).toBe(true);
    expect(canHandBeat(bomb8, bomb9)).toBe(false);
  });

  it("orders five-card bombs above four-card bombs", () => {
    const fourA = classifyHand(bomb("A", 4));
    const five3 = classifyHand(bomb("3", 5));

    expect(canHandBeat(five3, fourA)).toBe(true);
    expect(canHandBeat(fourA, five3)).toBe(false);
  });

  it("orders straight flush above five-card bomb but below six-card bomb", () => {
    const fiveA = classifyHand(bomb("A", 5));
    const royal = classifyHand(straightFlush(["10", "J", "Q", "K", "A"]));
    const six3 = classifyHand(bomb("3", 6));

    expect(royal.kind).toBe("straight-flush");
    expect(canHandBeat(royal, fiveA)).toBe(true);
    expect(canHandBeat(six3, royal)).toBe(true);
    expect(canHandBeat(royal, six3)).toBe(false);
  });

  it("orders longer six-plus bombs above shorter ones regardless of rank", () => {
    const sixA = classifyHand(bomb("A", 6));
    const seven3 = classifyHand(bomb("3", 7));

    expect(canHandBeat(seven3, sixA)).toBe(true);
    expect(canHandBeat(sixA, seven3)).toBe(false);
  });

  it("keeps joker bomb above every other bomb category", () => {
    const kings8 = classifyHand(bomb("K", 8));
    const jokers = classifyHand(jokerBomb);

    expect(jokers.kind).toBe("joker-bomb");
    expect(canHandBeat(jokers, kings8)).toBe(true);
    expect(canHandBeat(kings8, jokers)).toBe(false);
  });
});
