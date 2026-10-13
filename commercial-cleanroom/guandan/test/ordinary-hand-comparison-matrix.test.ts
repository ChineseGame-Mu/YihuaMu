import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";

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

const straight = (ranks: readonly Rank[]): Card[] =>
  ranks.map((rank, index) =>
    suited(
      rank,
      (["clubs", "diamonds", "spades", "hearts", "clubs"] as const)[index]!,
    ),
  );

const pairs = (ranks: readonly [Rank, Rank, Rank]): Card[] =>
  ranks.flatMap((rank) => repeated(rank, 2));

const triples = (ranks: readonly [Rank, Rank]): Card[] =>
  ranks.flatMap((rank) => repeated(rank, 3));

describe("ordinary hand comparison matrix", () => {
  it.each([
    [[suited("7")], [suited("8")]],
    [repeated("7", 2), repeated("8", 2)],
    [repeated("7", 3), repeated("8", 3)],
    [
      [...repeated("7", 3), ...repeated("9", 2)],
      [...repeated("8", 3), ...repeated("3", 2)],
    ],
    [straight(["3", "4", "5", "6", "7"]), straight(["4", "5", "6", "7", "8"])],
    [pairs(["3", "4", "5"]), pairs(["4", "5", "6"])],
    [triples(["3", "4"]), triples(["4", "5"])],
  ] as const)(
    "compares matching ordinary families by their controlling rank",
    (lowerCards, higherCards) => {
      const lower = classifyHand(lowerCards);
      const higher = classifyHand(higherCards);

      expect(canHandBeat(higher, lower)).toBe(true);
      expect(canHandBeat(lower, higher)).toBe(false);
    },
  );

  it("orders joker singles and pairs above suited ranks", () => {
    const ace = classifyHand([suited("A")]);
    const small = classifyHand([{ kind: "joker", size: "small" }]);
    const big = classifyHand([{ kind: "joker", size: "big" }]);
    const smallPair = classifyHand([
      { kind: "joker", size: "small" },
      { kind: "joker", size: "small" },
    ]);
    const bigPair = classifyHand([
      { kind: "joker", size: "big" },
      { kind: "joker", size: "big" },
    ]);

    expect(canHandBeat(small, ace)).toBe(true);
    expect(canHandBeat(big, small)).toBe(true);
    expect(canHandBeat(bigPair, smallPair)).toBe(true);
  });

  it("never compares unlike ordinary families as if rank alone were enough", () => {
    const pair = classifyHand(repeated("A", 2));
    const triple = classifyHand(repeated("3", 3));
    const fullHouse = classifyHand([...repeated("3", 3), ...repeated("4", 2)]);
    const straightHand = classifyHand(straight(["10", "J", "Q", "K", "A"]));

    expect(canHandBeat(triple, pair)).toBe(false);
    expect(canHandBeat(pair, triple)).toBe(false);
    expect(canHandBeat(straightHand, fullHouse)).toBe(false);
    expect(canHandBeat(fullHouse, straightHand)).toBe(false);
  });
});
