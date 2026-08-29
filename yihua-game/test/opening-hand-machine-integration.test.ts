import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { createLobbyState } from "../src/core/game-state.js";
import { transitionGame } from "../src/core/game-machine.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";

const suited = (suit: Suit, rank: Rank): Card => ({
  kind: "suited",
  suit,
  rank,
});

const constantRandom = (): number => 0;

describe("clean-room opening draw, hand classifier, and table machine integration", () => {
  it("starts the first round atomically while preserving the independent opening draw result", () => {
    const lobby = createLobbyState(4, 0);
    const playing = transitionGame(lobby, { type: "start-first-round" }, constantRandom);

    expect(playing.phase).toBe("playing");
    if (playing.phase !== "playing") throw new Error("expected playing state");

    expect(playing.openingDraw.attempts.length).toBeGreaterThan(0);
    expect(playing.openingDraw.winnerSeat).toBeGreaterThanOrEqual(0);
    expect(playing.openingDraw.winnerSeat).toBeLessThan(4);
    expect(playing.currentTurn).toBe(playing.openingDraw.winnerSeat);
    expect(playing.trick.leaderSeat).toBe(playing.openingDraw.winnerSeat);
    expect(playing.hands).toHaveLength(4);
    expect(playing.hands.every((hand) => hand.length === 27)).toBe(true);
  });

  it("keeps the explicit opening-draw phase available for UI animation and rejects duplicate starts", () => {
    const lobby = createLobbyState(4, 0);
    const opening = transitionGame(lobby, { type: "begin-opening-draw" }, constantRandom);

    expect(opening.phase).toBe("opening-draw");
    expect(() =>
      transitionGame(opening, { type: "start-first-round" }, constantRandom),
    ).toThrow("cannot start-first-round while game is opening-draw");
  });

  it("classifies the core Guandan combination families and compares bomb hierarchy", () => {
    expect(classifyHand([suited("clubs", "9")]).kind).toBe("single");
    expect(classifyHand([suited("clubs", "9"), suited("hearts", "9")]).kind).toBe("pair");
    expect(
      classifyHand([
        suited("clubs", "9"),
        suited("hearts", "9"),
        suited("spades", "9"),
      ]).kind,
    ).toBe("triple");
    expect(
      classifyHand([
        suited("clubs", "8"),
        suited("hearts", "8"),
        suited("spades", "8"),
        suited("clubs", "K"),
        suited("hearts", "K"),
      ]).kind,
    ).toBe("full-house");
    expect(
      classifyHand([
        suited("clubs", "3"),
        suited("hearts", "4"),
        suited("spades", "5"),
        suited("clubs", "6"),
        suited("hearts", "7"),
      ]).kind,
    ).toBe("straight");
    const straightFlush = classifyHand([
      suited("hearts", "5"),
      suited("hearts", "6"),
      suited("hearts", "7"),
      suited("hearts", "8"),
      suited("hearts", "9"),
    ]);
    expect(straightFlush.kind).toBe("straight-flush");
    expect(
      classifyHand([
        suited("clubs", "4"),
        suited("hearts", "4"),
        suited("clubs", "5"),
        suited("hearts", "5"),
        suited("clubs", "6"),
        suited("hearts", "6"),
      ]).kind,
    ).toBe("consecutive-pairs");
    expect(
      classifyHand([
        suited("clubs", "7"),
        suited("hearts", "7"),
        suited("spades", "7"),
        suited("clubs", "8"),
        suited("hearts", "8"),
        suited("spades", "8"),
      ]).kind,
    ).toBe("consecutive-triples");

    const fiveBomb = classifyHand(Array.from({ length: 5 }, () => suited("clubs", "10")));
    const sixBomb = classifyHand(Array.from({ length: 6 }, () => suited("clubs", "3")));
    const jokerBomb = classifyHand([
      { kind: "joker", size: "small" },
      { kind: "joker", size: "small" },
      { kind: "joker", size: "big" },
      { kind: "joker", size: "big" },
    ]);

    expect(canHandBeat(straightFlush, fiveBomb)).toBe(true);
    expect(canHandBeat(sixBomb, straightFlush)).toBe(true);
    expect(canHandBeat(jokerBomb, sixBomb)).toBe(true);
  });
});
