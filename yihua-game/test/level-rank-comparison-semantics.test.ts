import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { canHandBeatWithLevel, classifyHand } from "../src/core/hand.js";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const repeated = (rank: Rank, count: number): Card[] =>
  Array.from({ length: count }, (_, index) =>
    suited(rank, index % 2 === 0 ? "clubs" : "diamonds"),
  );

const mixedStraight = (ranks: readonly Rank[]): Card[] =>
  ranks.map((rank, index) =>
    suited(rank, index % 2 === 0 ? "clubs" : "diamonds"),
  );

describe("level-rank comparison semantics", () => {
  it("boosts the level rank above ace for same-rank ordinary hands", () => {
    const levelRank: Rank = "2";

    expect(
      canHandBeatWithLevel(
        classifyHand([suited(levelRank)]),
        classifyHand([suited("A")]),
        levelRank,
      ),
    ).toBe(true);

    expect(
      canHandBeatWithLevel(
        classifyHand(repeated(levelRank, 2)),
        classifyHand(repeated("A", 2)),
        levelRank,
      ),
    ).toBe(true);

    expect(
      canHandBeatWithLevel(
        classifyHand(repeated(levelRank, 3)),
        classifyHand(repeated("A", 3)),
        levelRank,
      ),
    ).toBe(true);
  });

  it("boosts a full house by its triple rank, not its pair rank", () => {
    const levelRank: Rank = "8";
    const levelTriple = classifyHand([
      ...repeated(levelRank, 3),
      ...repeated("3", 2),
    ]);
    const aceTriple = classifyHand([
      ...repeated("A", 3),
      ...repeated(levelRank, 2),
    ]);

    expect(levelTriple).toMatchObject({ kind: "full-house", rank: levelRank });
    expect(aceTriple).toMatchObject({ kind: "full-house", rank: "A" });
    expect(canHandBeatWithLevel(levelTriple, aceTriple, levelRank)).toBe(true);
  });

  it("does not boost a sequence merely because its high card is the level rank", () => {
    const levelRank: Rank = "K";
    const kingHigh = classifyHand(mixedStraight(["9", "10", "J", "Q", "K"]));
    const aceHigh = classifyHand(mixedStraight(["10", "J", "Q", "K", "A"]));

    expect(kingHigh).toMatchObject({ kind: "straight", highRank: "K" });
    expect(aceHigh).toMatchObject({ kind: "straight", highRank: "A" });
    expect(canHandBeatWithLevel(kingHigh, aceHigh, levelRank)).toBe(false);
    expect(canHandBeatWithLevel(aceHigh, kingHigh, levelRank)).toBe(true);
  });

  it("keeps bomb size ahead of level-rank strength", () => {
    const levelRank: Rank = "2";
    const fourLevelBomb = classifyHand(repeated(levelRank, 4));
    const fourAceBomb = classifyHand(repeated("A", 4));
    const fiveThreeBomb = classifyHand(repeated("3", 5));

    expect(canHandBeatWithLevel(fourLevelBomb, fourAceBomb, levelRank)).toBe(
      true,
    );
    expect(canHandBeatWithLevel(fiveThreeBomb, fourLevelBomb, levelRank)).toBe(
      true,
    );
    expect(canHandBeatWithLevel(fourLevelBomb, fiveThreeBomb, levelRank)).toBe(
      false,
    );
  });
});
