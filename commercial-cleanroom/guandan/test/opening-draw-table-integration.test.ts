import { describe, expect, it } from "vitest";

import { openingDrawStrength } from "../src/core/cards.js";
import {
  createLobbyState,
  dealAfterOpeningDraw,
  startOpeningDraw,
} from "../src/core/game-state.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

const deterministicRandom = (): (() => number) => {
  let state = 0x9e3779b9;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

describe("opening draw table integration", () => {
  for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
    it(`selects the first leader and deals 27 unique cards per seat for ${playerCount} players`, () => {
      const random = deterministicRandom();
      const opening = startOpeningDraw(
        createLobbyState(playerCount, 0),
        random,
      );

      expect(opening.openingDraw.winnerSeat).toBeGreaterThanOrEqual(0);
      expect(opening.openingDraw.winnerSeat).toBeLessThan(playerCount);
      expect(opening.openingDraw.attempts.length).toBeGreaterThan(0);

      const drawIds: string[] = [];
      for (const attempt of opening.openingDraw.attempts) {
        expect(attempt.cards).toHaveLength(playerCount);
        expect(attempt.cards.every(({ card }) => card.kind === "suited")).toBe(
          true,
        );
        drawIds.push(...attempt.cards.map(({ id }) => id));
      }
      expect(new Set(drawIds).size).toBe(drawIds.length);
      expect(
        opening.openingDraw.attempts
          .slice(0, -1)
          .every(({ winnerSeat }) => winnerSeat === null),
      ).toBe(true);

      const finalAttempt = opening.openingDraw.attempts.at(-1)!;
      expect(finalAttempt.winnerSeat).toBe(opening.openingDraw.winnerSeat);
      const finalStrengths = finalAttempt.cards.map(({ card }) =>
        openingDrawStrength(card),
      );
      expect(finalStrengths[opening.openingDraw.winnerSeat]).toBe(
        Math.max(...finalStrengths),
      );

      const playing = dealAfterOpeningDraw(opening, random);
      expect(playing.currentTurn).toBe(opening.openingDraw.winnerSeat);
      expect(playing.trick.leaderSeat).toBe(opening.openingDraw.winnerSeat);
      expect(playing.hands).toHaveLength(playerCount);
      expect(playing.hands.every((hand) => hand.length === 27)).toBe(true);

      const dealtIds = playing.hands.flat().map(({ id }) => id);
      expect(dealtIds).toHaveLength(playerCount * 27);
      expect(new Set(dealtIds).size).toBe(dealtIds.length);
    });
  }
});
