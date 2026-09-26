import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { classifyHand } from "../src/core/hand.js";
import { createTrickState, playCards } from "../src/core/trick-state.js";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  suit,
  rank,
});

const repeated = (rank: Rank, count: number): Card[] =>
  Array.from({ length: count }, (_, index) =>
    suited(
      rank,
      (["clubs", "diamonds", "spades", "hearts"] as const)[index % 4]!,
    ),
  );

const straightFlush = (high: "6" | "7"): Card[] => {
  const ranks =
    high === "6"
      ? (["2", "3", "4", "5", "6"] as const)
      : (["3", "4", "5", "6", "7"] as const);
  return ranks.map((rank) => suited(rank, "hearts"));
};

describe("full hand hierarchy through the table trick state", () => {
  it("classifies the major combination families used by the table machine", () => {
    expect(classifyHand([suited("7")]).kind).toBe("single");
    expect(classifyHand(repeated("7", 2)).kind).toBe("pair");
    expect(classifyHand(repeated("7", 3)).kind).toBe("triple");
    expect(classifyHand([...repeated("7", 3), ...repeated("8", 2)]).kind).toBe(
      "full-house",
    );
    expect(
      classifyHand([
        suited("3"),
        suited("4", "diamonds"),
        suited("5", "spades"),
        suited("6", "hearts"),
        suited("7"),
      ]).kind,
    ).toBe("straight");
    expect(classifyHand(straightFlush("7")).kind).toBe("straight-flush");
    expect(
      classifyHand([
        ...repeated("3", 2),
        ...repeated("4", 2),
        ...repeated("5", 2),
      ]).kind,
    ).toBe("consecutive-pairs");
    expect(classifyHand([...repeated("3", 3), ...repeated("4", 3)]).kind).toBe(
      "consecutive-triples",
    );
    expect(classifyHand(repeated("9", 4)).kind).toBe("bomb");
  });

  it("enforces bomb and straight-flush escalation inside one trick", () => {
    let state = createTrickState(4, 0);
    state = playCards(state, 0, repeated("7", 4));
    state = playCards(state, 1, repeated("8", 5));
    state = playCards(state, 2, straightFlush("7"));
    state = playCards(state, 3, repeated("3", 6));

    expect(state.leadingPlay?.seat).toBe(3);
    expect(state.leadingPlay?.hand).toMatchObject({
      kind: "bomb",
      size: 6,
      rank: "3",
    });
    expect(() => playCards(state, 0, straightFlush("7"))).toThrow(
      "played hand does not beat the current hand",
    );
  });

  it("rejects a lower ordinary combination without disturbing the current leader", () => {
    let state = createTrickState(4, 0);
    state = playCards(state, 0, [...repeated("7", 3), ...repeated("8", 2)]);

    expect(() =>
      playCards(state, 1, [...repeated("6", 3), ...repeated("9", 2)]),
    ).toThrow("played hand does not beat the current hand");
    expect(state.leadingPlay?.seat).toBe(0);
    expect(state.currentTurn).toBe(1);
  });
});
