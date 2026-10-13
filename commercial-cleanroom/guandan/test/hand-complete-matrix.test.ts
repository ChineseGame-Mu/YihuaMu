import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});
const joker = (size: "small" | "big"): Card => ({ kind: "joker", size });
const ranks = (values: readonly Rank[], suit: Suit = "clubs") =>
  values.map((rank) => suited(rank, suit));

describe("complete hand classification matrix", () => {
  it("classifies every supported normal combination", () => {
    expect(classifyHand([suited("8")]).kind).toBe("single");
    expect(classifyHand([suited("8"), suited("8", "hearts")]).kind).toBe(
      "pair",
    );
    expect(
      classifyHand([suited("8"), suited("8", "hearts"), suited("8", "spades")])
        .kind,
    ).toBe("triple");
    expect(
      classifyHand([
        suited("8"),
        suited("8", "hearts"),
        suited("8", "spades"),
        suited("9"),
        suited("9", "hearts"),
      ]).kind,
    ).toBe("full-house");
    expect(classifyHand(ranks(["5", "6", "7", "8", "9"], "hearts")).kind).toBe(
      "straight-flush",
    );
    expect(
      classifyHand([
        suited("5"),
        suited("6", "hearts"),
        suited("7"),
        suited("8", "spades"),
        suited("9"),
      ]).kind,
    ).toBe("straight");
    expect(
      classifyHand([
        suited("5"),
        suited("5", "hearts"),
        suited("6"),
        suited("6", "hearts"),
        suited("7"),
        suited("7", "hearts"),
      ]).kind,
    ).toBe("consecutive-pairs");
    expect(
      classifyHand([
        suited("5"),
        suited("5", "hearts"),
        suited("5", "spades"),
        suited("6"),
        suited("6", "hearts"),
        suited("6", "spades"),
      ]).kind,
    ).toBe("consecutive-triples");
  });

  it("supports wheel straight and rejects sequences containing 2 otherwise", () => {
    expect(
      classifyHand([
        suited("A"),
        suited("2", "hearts"),
        suited("3"),
        suited("4", "spades"),
        suited("5"),
      ]),
    ).toMatchObject({ kind: "straight", highRank: "5" });
    expect(
      classifyHand([
        suited("J"),
        suited("Q", "hearts"),
        suited("K"),
        suited("A", "spades"),
        suited("2"),
      ]).kind,
    ).toBe("invalid");
  });

  it("enforces bomb hierarchy and joker-bomb supremacy", () => {
    const bomb4 = classifyHand([
      suited("A"),
      suited("A", "hearts"),
      suited("A", "spades"),
      suited("A", "diamonds"),
    ]);
    const bomb5 = classifyHand([
      ...Array.from({ length: 5 }, (_, i) =>
        suited(
          "3",
          (["clubs", "hearts", "spades", "diamonds", "clubs"] as Suit[])[i]!,
        ),
      ),
    ]);
    const straightFlush = classifyHand(
      ranks(["9", "10", "J", "Q", "K"], "hearts"),
    );
    const bomb6 = classifyHand(
      Array.from({ length: 6 }, (_, i) =>
        suited(
          "2",
          (
            [
              "clubs",
              "hearts",
              "spades",
              "diamonds",
              "clubs",
              "hearts",
            ] as Suit[]
          )[i]!,
        ),
      ),
    );
    const jokerBomb = classifyHand([
      joker("small"),
      joker("small"),
      joker("big"),
      joker("big"),
    ]);

    expect(canHandBeat(bomb5, bomb4)).toBe(true);
    expect(canHandBeat(straightFlush, bomb5)).toBe(true);
    expect(canHandBeat(bomb6, straightFlush)).toBe(true);
    expect(canHandBeat(jokerBomb, bomb6)).toBe(true);
    expect(canHandBeat(bomb6, jokerBomb)).toBe(false);
  });

  it("compares only matching non-bomb shapes", () => {
    const pair9 = classifyHand([suited("9"), suited("9", "hearts")]);
    const pair10 = classifyHand([suited("10"), suited("10", "hearts")]);
    const triple10 = classifyHand([
      suited("10"),
      suited("10", "hearts"),
      suited("10", "spades"),
    ]);
    expect(canHandBeat(pair10, pair9)).toBe(true);
    expect(canHandBeat(pair9, pair10)).toBe(false);
    expect(canHandBeat(triple10, pair9)).toBe(false);
  });

  it("orders small and big joker singles", () => {
    expect(
      canHandBeat(classifyHand([joker("big")]), classifyHand([joker("small")])),
    ).toBe(true);
    expect(
      canHandBeat(classifyHand([joker("small")]), classifyHand([suited("A")])),
    ).toBe(true);
  });
});
