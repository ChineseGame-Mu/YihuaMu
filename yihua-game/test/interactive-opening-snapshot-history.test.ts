import { describe, expect, it } from "vitest";
import { createLobbyState } from "../src/core/game-state.js";
import {
  advanceInteractiveOpeningDraw,
  beginInteractiveOpeningDraw,
  completeInteractiveOpeningDraw,
  interactiveOpeningSnapshot,
} from "../src/core/interactive-opening-state.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

const deterministicRandom = (): (() => number) => {
  let seed = 0x9e3779b9;
  return () => {
    seed = Math.imul(seed ^ (seed >>> 16), 0x21f0aaad);
    seed = Math.imul(seed ^ (seed >>> 15), 0x735a2d97);
    return ((seed ^= seed >>> 15) >>> 0) / 4294967296;
  };
};

describe("interactive opening snapshot history", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "exposes every opening-draw attempt needed by the UI for %i players",
    (playerCount) => {
      const initial = beginInteractiveOpeningDraw(
        createLobbyState(playerCount, 0),
        deterministicRandom(),
      );
      const initialSnapshot = interactiveOpeningSnapshot(initial);

      expect(initialSnapshot.attempts).toEqual([]);
      expect(initialSnapshot.winnerSeat).toBeNull();
      expect(initialSnapshot.readyToDeal).toBe(false);
      expect(initialSnapshot.progress.attemptsCompleted).toBe(0);

      const afterOneDraw = advanceInteractiveOpeningDraw(initial);
      const afterOneSnapshot = interactiveOpeningSnapshot(afterOneDraw);

      expect(afterOneSnapshot.attempts).toHaveLength(1);
      expect(afterOneSnapshot.progress.attemptsCompleted).toBe(1);
      expect(afterOneSnapshot.progress.lastAttempt).toEqual(
        afterOneSnapshot.attempts[0],
      );
      expect(afterOneSnapshot.winnerSeat).toBe(afterOneDraw.draw.session.winnerSeat);
      expect(afterOneSnapshot.readyToDeal).toBe(
        afterOneSnapshot.winnerSeat !== null,
      );

      const completed = completeInteractiveOpeningDraw(afterOneDraw);
      const completedSnapshot = interactiveOpeningSnapshot(completed);

      expect(completedSnapshot.attempts.length).toBeGreaterThanOrEqual(1);
      expect(completedSnapshot.winnerSeat).not.toBeNull();
      expect(completedSnapshot.progress.winnerSeat).toBe(
        completedSnapshot.winnerSeat,
      );
      expect(completedSnapshot.readyToDeal).toBe(true);
      expect(completedSnapshot.prompt.canDraw).toBe(false);
      expect(completedSnapshot.prompt.seatsToDraw).toEqual([]);
    },
  );
});
