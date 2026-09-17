import { describe, expect, it } from "vitest";
import { createLobbyState } from "../src/core/game-state.js";
import {
  beginInteractiveOpeningDraw,
  completeInteractiveOpeningDraw,
  dealAfterInteractiveOpeningDraw,
  finishInteractiveOpeningDraw,
} from "../src/core/interactive-opening-state.js";

const supportedCounts = [4, 6, 8, 10, 12, 14] as const;

describe("interactive opening draw completion", () => {
  it.each(supportedCounts)(
    "completes the first-round draw and hands its winner to a %i-player table",
    (playerCount) => {
      const opening = completeInteractiveOpeningDraw(
        beginInteractiveOpeningDraw(createLobbyState(playerCount, 0), () => 0),
      );
      const finished = finishInteractiveOpeningDraw(opening);
      const playing = dealAfterInteractiveOpeningDraw(opening, () => 0);

      expect(opening.draw.phase).toBe("complete");
      expect(finished.openingDraw.attempts.length).toBeGreaterThan(0);
      expect(finished.openingDraw.winnerSeat).toBeGreaterThanOrEqual(0);
      expect(finished.openingDraw.winnerSeat).toBeLessThan(playerCount);
      expect(playing.phase).toBe("playing");
      expect(playing.currentTurn).toBe(finished.openingDraw.winnerSeat);
      expect(playing.hands).toHaveLength(playerCount);
    },
  );
});
