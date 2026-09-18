import { describe, expect, it } from "vitest";

import type { Card } from "../src/core/cards.js";
import {
  classifyGameCardIds,
  playGameCardIds,
} from "../src/core/game-actions.js";
import type { PlayingState } from "../src/core/game-state.js";
import { canHandBeatWithLevel, classifyHand } from "../src/core/hand.js";
import { classifyHandWithLevel } from "../src/core/level-hand.js";
import { createTrickState } from "../src/core/trick-state.js";

const suited = (
  rank: Extract<Card, { kind: "suited" }>["rank"],
  suit: Extract<Card, { kind: "suited" }>["suit"] = "clubs",
): Card => ({ kind: "suited", rank, suit });

const steel222333: Card[] = [
  suited("2", "diamonds"),
  suited("2", "diamonds"),
  suited("2", "hearts"),
  suited("3", "clubs"),
  suited("3", "spades"),
  suited("3", "hearts"),
];

const steel333444: Card[] = [
  suited("3", "clubs"),
  suited("3", "diamonds"),
  suited("3", "spades"),
  suited("4", "clubs"),
  suited("4", "diamonds"),
  suited("4", "spades"),
];

describe("222333 steel-plate live regression", () => {
  it("classifies 222333 as the lowest consecutive-triples hand", () => {
    expect(classifyHand(steel222333)).toEqual({
      kind: "consecutive-triples",
      size: 6,
      highRank: "3",
    });
    expect(classifyHandWithLevel(steel222333, "4")).toEqual({
      kind: "consecutive-triples",
      size: 6,
      highRank: "3",
    });
    expect(
      canHandBeatWithLevel(
        classifyHandWithLevel(steel333444, "4"),
        classifyHandWithLevel(steel222333, "4"),
        "4",
      ),
    ).toBe(true);
  });

  it("accepts the exact six authoritative card ids at the play boundary", () => {
    const ids = steel222333.map((_, index) => `steel-${index}`);
    const hand = [
      ...steel222333.map((card, index) => ({ id: ids[index]!, card })),
      { id: "remaining", card: suited("5") },
    ];
    const state = {
      phase: "playing",
      config: { playerCount: 4, botCount: 0 },
      hands: [
        hand,
        [{ id: "p1", card: suited("6") }],
        [{ id: "p2", card: suited("7") }],
        [{ id: "p3", card: suited("8") }],
      ],
      currentTurn: 0,
      trick: createTrickState(4, 0),
      levelRank: "4",
      finishedSeats: [],
    } as unknown as PlayingState;

    expect(classifyGameCardIds(state, 0, ids)).toMatchObject({
      kind: "consecutive-triples",
      highRank: "3",
    });
    const next = playGameCardIds(state, 0, ids);
    if (next.phase !== "playing") throw new Error("round ended unexpectedly");
    expect(next.trick.leadingPlay?.hand).toMatchObject({
      kind: "consecutive-triples",
      highRank: "3",
    });
    expect(next.hands[0]?.map(({ id }) => id)).toEqual(["remaining"]);
  });
});
