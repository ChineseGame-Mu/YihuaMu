import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import {
  createTrickState,
  passTurn,
  playCards,
} from "../src/core/trick-state.js";

const three: Card = { kind: "suited", rank: "3", suit: "clubs" };

describe("finished leader rotation", () => {
  it("moves a completed trick to the nearest active seat when the winner is no longer active", () => {
    const responders = [1, 3, 5] as const;
    const led = playCards(createTrickState(6, 0), 0, [three], responders);

    expect(led.currentTurn).toBe(1);

    const afterOne = passTurn(led, 1, responders);
    expect(afterOne.currentTurn).toBe(3);

    const afterThree = passTurn(afterOne, 3, responders);
    expect(afterThree.currentTurn).toBe(5);

    const completed = passTurn(afterThree, 5, responders);
    expect(completed.leadingPlay).toBeNull();
    expect(completed.completedTricks).toBe(1);
    expect(completed.currentTurn).toBe(1);
    expect(completed.leaderSeat).toBe(1);
  });
});
