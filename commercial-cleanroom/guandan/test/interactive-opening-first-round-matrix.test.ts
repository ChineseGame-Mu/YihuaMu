import { describe, expect, it } from "vitest";
import { createLobbyState } from "../src/core/game-state.js";
import { startInteractiveFirstRound } from "../src/core/interactive-opening-state.js";
import { CARDS_PER_PLAYER } from "../src/core/table.js";

const supportedCounts = [4, 6, 8, 10, 12, 14] as const;
const stableRandom = (): number => 0.999999;

describe("interactive first-round opening-to-table handoff", () => {
  for (const playerCount of supportedCounts) {
    it(`keeps the opening-draw winner as the initial leader for ${playerCount} players`, () => {
      const lobby = createLobbyState(playerCount, 0);
      const playing = startInteractiveFirstRound(lobby, stableRandom);

      expect(playing.phase).toBe("playing");
      expect(playing.openingDraw.attempts.length).toBeGreaterThan(0);
      expect(playing.currentTurn).toBe(playing.openingDraw.winnerSeat);
      expect(playing.trick.currentTurn).toBe(playing.openingDraw.winnerSeat);
      expect(playing.trick.leaderSeat).toBe(playing.openingDraw.winnerSeat);
      expect(playing.finishedSeats).toEqual([]);

      expect(playing.hands).toHaveLength(playerCount);
      for (const hand of playing.hands) {
        expect(hand).toHaveLength(CARDS_PER_PLAYER);
      }

      const dealtIds = playing.hands.flat().map(({ id }) => id);
      expect(new Set(dealtIds).size).toBe(playerCount * CARDS_PER_PLAYER);
    });
  }
});
