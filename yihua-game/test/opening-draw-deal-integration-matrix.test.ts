import { describe, expect, it } from "vitest";
import { createDeck } from "../src/core/deck.js";
import {
  completeOpeningDrawMachine,
  createOpeningDrawMachine,
  openingDrawMachineProgress,
  openingDrawMachineResult,
} from "../src/core/opening-draw-machine.js";
import {
  dealAfterOpeningDraw,
  type OpeningDrawState,
} from "../src/core/game-state.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const supportedCounts: readonly SupportedPlayerCount[] = [4, 6, 8, 10, 12, 14];
const deterministicRandom = (): number => 0.3141592653589793;

describe("independent opening draw to deal integration", () => {
  for (const playerCount of supportedCounts) {
    it(`carries the unique opening winner into the ${playerCount}-player first deal`, () => {
      const machine = completeOpeningDrawMachine(
        createOpeningDrawMachine(
          createDeck(playerCount),
          playerCount,
          deterministicRandom,
        ),
      );
      const progress = openingDrawMachineProgress(machine);
      const result = openingDrawMachineResult(machine);

      expect(progress.phase).toBe("complete");
      expect(result).not.toBeNull();
      expect(result!.winnerSeat).toBeGreaterThanOrEqual(0);
      expect(result!.winnerSeat).toBeLessThan(playerCount);
      expect(result!.attempts.length).toBeGreaterThan(0);
      expect(
        result!.attempts.every((attempt) =>
          attempt.cards.every(({ card }) => card.kind === "suited"),
        ),
      ).toBe(true);

      const opening: OpeningDrawState = {
        phase: "opening-draw",
        config: { playerCount },
        openingDraw: result!,
      };
      const playing = dealAfterOpeningDraw(opening, deterministicRandom);

      expect(playing.phase).toBe("playing");
      expect(playing.currentTurn).toBe(result!.winnerSeat);
      expect(playing.hands).toHaveLength(playerCount);
      expect(playing.hands.every((hand) => hand.length > 0)).toBe(true);
    });
  }
});
