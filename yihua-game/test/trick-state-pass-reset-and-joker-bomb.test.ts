import { describe, expect, it } from "vitest";
import type { Card, Rank } from "../src/core/cards.js";
import { createTrickState, passTurn, playCards } from "../src/core/trick-state.js";

const suited = (rank: Rank): Card => ({
  kind: "suited",
  suit: "clubs",
  rank,
});

const repeated = (rank: Rank, count: number): Card[] =>
  Array.from({ length: count }, () => suited(rank));

const jokerBomb = (): Card[] => [
  { kind: "joker", size: "small" },
  { kind: "joker", size: "small" },
  { kind: "joker", size: "big" },
  { kind: "joker", size: "big" },
];

describe("table trick pass reset and joker-bomb hierarchy", () => {
  it("resets earlier passes when a later seat takes the lead", () => {
    let state = createTrickState(4, 0);
    state = playCards(state, 0, [suited("3")]);
    state = passTurn(state, 1);

    expect(state.passedSeats).toEqual([1]);

    state = playCards(state, 2, [suited("4")]);

    expect(state.leadingPlay?.seat).toBe(2);
    expect(state.passedSeats).toEqual([]);
    expect(state.currentTurn).toBe(3);
  });

  it.each([4, 6, 8, 10, 12, 14] as const)(
    "restarts the pass quorum after a mid-trick beat at a %i-player table",
    (playerCount) => {
      let state = createTrickState(playerCount, 0);
      state = playCards(state, 0, [suited("3")]);
      state = passTurn(state, 1);
      state = playCards(state, 2, [suited("4")]);

      const responders = [
        ...Array.from({ length: playerCount - 3 }, (_, index) => index + 3),
        0,
        1,
      ];
      for (const seat of responders) {
        state = passTurn(state, seat);
      }

      expect(state.completedTricks).toBe(1);
      expect(state.leadingPlay).toBeNull();
      expect(state.leaderSeat).toBe(2);
      expect(state.currentTurn).toBe(2);
      expect(state.passedSeats).toEqual([]);
    },
  );

  it("lets the complete joker bomb overtake the largest ordinary bomb", () => {
    let state = createTrickState(4, 0);
    state = playCards(state, 0, repeated("A", 8));
    state = playCards(state, 1, jokerBomb());

    expect(state.leadingPlay?.seat).toBe(1);
    expect(state.leadingPlay?.hand).toMatchObject({
      kind: "joker-bomb",
      size: 4,
    });
    expect(() => playCards(state, 2, repeated("A", 10))).toThrow(
      "played hand does not beat the current hand",
    );
  });
});
