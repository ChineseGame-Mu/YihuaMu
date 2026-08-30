import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import { classifyGameCardIds } from "../src/core/game-actions.js";
import type { PlayingState } from "../src/core/game-state.js";

const card = (id: string, value: Card) => ({ id, card: value });
const suited = (
  id: string,
  rank: Extract<Card, { kind: "suited" }>["rank"],
  suit: Extract<Card, { kind: "suited" }>["suit"] = "clubs",
) => card(id, { kind: "suited", rank, suit });

const state = {
  hands: [
    [
      suited("single-7", "7"),
      suited("pair-7-a", "7"),
      suited("pair-7-b", "7", "diamonds"),
      suited("triple-8-a", "8"),
      suited("triple-8-b", "8", "diamonds"),
      suited("triple-8-c", "8", "hearts"),
      suited("full-9-a", "9"),
      suited("full-9-b", "9", "diamonds"),
      suited("full-9-c", "9", "hearts"),
      suited("full-10-a", "10"),
      suited("full-10-b", "10", "diamonds"),
      suited("straight-3", "3", "clubs"),
      suited("straight-4", "4", "diamonds"),
      suited("straight-5", "5", "hearts"),
      suited("straight-6", "6", "spades"),
      suited("straight-7", "7", "clubs"),
      suited("sf-3", "3", "hearts"),
      suited("sf-4", "4", "hearts"),
      suited("sf-5", "5", "hearts"),
      suited("sf-6", "6", "hearts"),
      suited("sf-7", "7", "hearts"),
      suited("cp-3-a", "3"),
      suited("cp-3-b", "3", "diamonds"),
      suited("cp-4-a", "4"),
      suited("cp-4-b", "4", "diamonds"),
      suited("cp-5-a", "5"),
      suited("cp-5-b", "5", "diamonds"),
      suited("ct-6-a", "6"),
      suited("ct-6-b", "6", "diamonds"),
      suited("ct-6-c", "6", "hearts"),
      suited("ct-7-a", "7"),
      suited("ct-7-b", "7", "diamonds"),
      suited("ct-7-c", "7", "hearts"),
      suited("bomb-j-a", "J"),
      suited("bomb-j-b", "J", "diamonds"),
      suited("bomb-j-c", "J", "hearts"),
      suited("bomb-j-d", "J", "spades"),
      card("joker-small-a", { kind: "joker", size: "small" }),
      card("joker-small-b", { kind: "joker", size: "small" }),
      card("joker-big-a", { kind: "joker", size: "big" }),
      card("joker-big-b", { kind: "joker", size: "big" }),
    ],
  ],
} as unknown as PlayingState;

const cases: readonly [string, readonly string[]][] = [
  ["single", ["single-7"]],
  ["pair", ["pair-7-a", "pair-7-b"]],
  ["triple", ["triple-8-a", "triple-8-b", "triple-8-c"]],
  [
    "full-house",
    ["full-9-a", "full-9-b", "full-9-c", "full-10-a", "full-10-b"],
  ],
  [
    "straight",
    ["straight-3", "straight-4", "straight-5", "straight-6", "straight-7"],
  ],
  ["straight-flush", ["sf-3", "sf-4", "sf-5", "sf-6", "sf-7"]],
  [
    "consecutive-pairs",
    ["cp-3-a", "cp-3-b", "cp-4-a", "cp-4-b", "cp-5-a", "cp-5-b"],
  ],
  [
    "consecutive-triples",
    ["ct-6-a", "ct-6-b", "ct-6-c", "ct-7-a", "ct-7-b", "ct-7-c"],
  ],
  ["bomb", ["bomb-j-a", "bomb-j-b", "bomb-j-c", "bomb-j-d"]],
  [
    "joker-bomb",
    ["joker-small-a", "joker-small-b", "joker-big-a", "joker-big-b"],
  ],
];

describe("selected hand classification at the table action boundary", () => {
  it.each(cases)("classifies %s from authoritative private card ids", (kind, ids) => {
    expect(classifyGameCardIds(state, 0, ids).kind).toBe(kind);
  });

  it("rejects duplicate, missing, and empty card-id selections before table transition", () => {
    expect(() => classifyGameCardIds(state, 0, [])).toThrow(
      "at least one card id is required",
    );
    expect(() =>
      classifyGameCardIds(state, 0, ["single-7", "single-7"]),
    ).toThrow("card ids must be unique");
    expect(() => classifyGameCardIds(state, 0, ["not-in-hand"])).toThrow(
      "card not-in-hand is not in seat's hand",
    );
  });
});
