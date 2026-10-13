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

const steelAAA222: Card[] = [
  suited("A", "clubs"),
  suited("A", "diamonds"),
  suited("A", "hearts"),
  suited("2", "clubs"),
  suited("2", "diamonds"),
  suited("2", "spades"),
];

const pairsAA2233: Card[] = [
  suited("A", "clubs"),
  suited("A", "diamonds"),
  suited("2", "clubs"),
  suited("2", "diamonds"),
  suited("3", "clubs"),
  suited("3", "diamonds"),
];

const wheelA2345: Card[] = [
  suited("A", "clubs"),
  suited("2", "diamonds"),
  suited("3", "hearts"),
  suited("4", "spades"),
  suited("5", "clubs"),
];

const straight23456: Card[] = [
  suited("2", "clubs"),
  suited("3", "diamonds"),
  suited("4", "hearts"),
  suited("5", "spades"),
  suited("6", "clubs"),
];

const straightFlushA2345: Card[] = [
  suited("A", "spades"),
  suited("2", "spades"),
  suited("3", "spades"),
  suited("4", "spades"),
  suited("5", "spades"),
];

const straightFlush23456: Card[] = [
  suited("2", "clubs"),
  suited("3", "clubs"),
  suited("4", "clubs"),
  suited("5", "clubs"),
  suited("6", "clubs"),
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
  it("accepts the approved low sequences and straight flushes", () => {
    expect(classifyHand(steelAAA222)).toEqual({
      kind: "consecutive-triples",
      size: 6,
      highRank: "2",
    });
    expect(classifyHand(pairsAA2233)).toEqual({
      kind: "consecutive-pairs",
      size: 6,
      highRank: "3",
    });
    expect(classifyHand(wheelA2345)).toEqual({
      kind: "straight",
      size: 5,
      highRank: "5",
    });
    expect(
      canHandBeatWithLevel(
        classifyHandWithLevel(straight23456, "7"),
        classifyHandWithLevel(wheelA2345, "7"),
        "7",
      ),
    ).toBe(true);
    expect(
      canHandBeatWithLevel(
        classifyHandWithLevel(wheelA2345, "7"),
        classifyHandWithLevel(straight23456, "7"),
        "7",
      ),
    ).toBe(false);
    expect(classifyHand(straightFlushA2345)).toEqual({
      kind: "straight-flush",
      size: 5,
      highRank: "5",
    });
    expect(classifyHand(straightFlush23456)).toEqual({
      kind: "straight-flush",
      size: 5,
      highRank: "6",
    });
    expect(
      canHandBeatWithLevel(
        classifyHandWithLevel(straightFlush23456, "7"),
        classifyHandWithLevel(straightFlushA2345, "7"),
        "7",
      ),
    ).toBe(true);
    expect(
      canHandBeatWithLevel(
        classifyHandWithLevel(straightFlushA2345, "7"),
        classifyHandWithLevel(straightFlush23456, "7"),
        "7",
      ),
    ).toBe(false);
    expect(
      canHandBeatWithLevel(
        classifyHandWithLevel(steel222333, "4"),
        classifyHandWithLevel(steelAAA222, "4"),
        "4",
      ),
    ).toBe(true);
  });

  it("supports level-wildcard completion of the new low sequences", () => {
    const wildcard = suited("5", "hearts");
    expect(
      classifyHandWithLevel([...steelAAA222.slice(0, 5), wildcard], "5"),
    ).toEqual({
      kind: "consecutive-triples",
      size: 6,
      highRank: "2",
    });
    expect(
      classifyHandWithLevel([...pairsAA2233.slice(1), wildcard], "5"),
    ).toEqual({
      kind: "consecutive-pairs",
      size: 6,
      highRank: "3",
    });
  });

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
