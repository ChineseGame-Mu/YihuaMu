import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import {
  createTrickState,
  playCardsWithLevel,
} from "../src/core/trick-state.js";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const wild = (levelRank: Rank): Card => suited(levelRank, "hearts");

describe("level wildcard trick plays", () => {
  it.each([4, 6, 8, 10, 12, 14] as const)(
    "allows a wildcard straight to lead and rotates at a %i-player table",
    (playerCount) => {
      const state = playCardsWithLevel(
        createTrickState(playerCount, 0),
        0,
        [
          suited("7"),
          suited("8", "diamonds"),
          suited("9"),
          suited("J"),
          wild("6"),
        ],
        "6",
      );

      expect(state.leadingPlay?.hand).toEqual({
        kind: "straight",
        size: 5,
        highRank: "J",
      });
      expect(state.leaderSeat).toBe(0);
      expect(state.currentTurn).toBe(1);
    },
  );

  it("allows a higher wildcard straight to beat the current straight", () => {
    let state = playCardsWithLevel(
      createTrickState(4, 0),
      0,
      [
        suited("6"),
        suited("7", "diamonds"),
        suited("8"),
        suited("9"),
        suited("10"),
      ],
      "5",
    );

    state = playCardsWithLevel(
      state,
      1,
      [
        suited("7"),
        suited("8", "diamonds"),
        suited("9"),
        suited("J"),
        wild("6"),
      ],
      "6",
    );

    expect(state.leadingPlay?.seat).toBe(1);
    expect(state.leadingPlay?.hand).toEqual({
      kind: "straight",
      size: 5,
      highRank: "J",
    });
    expect(state.currentTurn).toBe(2);
  });

  it("lets a wildcard-completed bomb beat a normal non-bomb hand", () => {
    let state = playCardsWithLevel(
      createTrickState(4, 0),
      0,
      [suited("9"), suited("9", "diamonds")],
      "6",
    );

    state = playCardsWithLevel(
      state,
      1,
      [
        suited("Q"),
        suited("Q", "diamonds"),
        suited("Q", "spades"),
        wild("6"),
      ],
      "6",
    );

    expect(state.leadingPlay?.hand).toEqual({
      kind: "bomb",
      size: 4,
      rank: "Q",
    });
  });

  it("rejects a non-heart level card when it cannot form a natural hand", () => {
    expect(() =>
      playCardsWithLevel(
        createTrickState(4, 0),
        0,
        [suited("9"), suited("6", "clubs")],
        "6",
      ),
    ).toThrow("invalid hand");
  });
});
