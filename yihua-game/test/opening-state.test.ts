import { describe, expect, it } from "vitest";

import { createDeck } from "../src/core/deck.js";
import { completeRound, createLobbyState, startGame } from "../src/core/game-state.js";
import { runOpeningDraw } from "../src/core/opening-draw.js";
import { CARDS_PER_PLAYER, SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

describe("opening draw", () => {
  it("never uses jokers and produces a valid starter", () => {
    for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
      const result = runOpeningDraw(createDeck(playerCount), playerCount, () => 0.37);
      expect(result.winnerSeat).toBeGreaterThanOrEqual(0);
      expect(result.winnerSeat).toBeLessThan(playerCount);
      expect(
        result.attempts.every((attempt) =>
          attempt.cards.every(({ card }) => card.kind === "suited"),
        ),
      ).toBe(true);
    }
  });
});

describe("table state machine", () => {
  it("starts every supported table with 27 cards per player and the draw winner on turn", () => {
    for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
      const lobby = createLobbyState(playerCount, 0);
      const state = startGame(lobby, () => 0.42);

      expect(state.phase).toBe("playing");
      expect(state.hands).toHaveLength(playerCount);
      expect(state.hands.every((hand) => hand.length === CARDS_PER_PLAYER)).toBe(true);
      expect(state.currentTurn).toBe(state.openingDraw.winnerSeat);
    }
  });

  it("records a valid round winner", () => {
    const playing = startGame(createLobbyState(4, 1), () => 0.61);
    const complete = completeRound(playing, 2);

    expect(complete.phase).toBe("round-complete");
    expect(complete.winnerSeat).toBe(2);
  });

  it("rejects a winner outside the table", () => {
    const playing = startGame(createLobbyState(4, 0), () => 0.51);
    expect(() => completeRound(playing, 4)).toThrow();
  });
});
