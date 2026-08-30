import { describe, expect, it } from "vitest";
import { createDeck } from "../src/core/deck.js";
import {
  advanceOpeningDrawMachine,
  completeOpeningDrawMachine,
  createOpeningDrawMachine,
  openingDrawMachineProgress,
} from "../src/core/opening-draw-machine.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const supportedCounts: readonly SupportedPlayerCount[] = [4, 6, 8, 10, 12, 14];
const fixedRandom = (): number => 0.375;

const ordinaryCardCount = (playerCount: SupportedPlayerCount): number =>
  createDeck(playerCount).filter(({ card }) => card.kind === "suited").length;

describe("opening draw progress matrix", () => {
  for (const playerCount of supportedCounts) {
    it(`reports coherent progress for ${playerCount} players`, () => {
      const initial = createOpeningDrawMachine(
        createDeck(playerCount),
        playerCount,
        fixedRandom,
      );
      const initialProgress = openingDrawMachineProgress(initial);

      expect(initialProgress).toEqual({
        phase: "drawing",
        attemptsCompleted: 0,
        cardsDrawn: 0,
        cardsRemaining: ordinaryCardCount(playerCount),
        winnerSeat: null,
        lastAttempt: null,
      });

      const advanced = advanceOpeningDrawMachine(initial);
      const advancedProgress = openingDrawMachineProgress(advanced);

      expect(advancedProgress.attemptsCompleted).toBe(1);
      expect(advancedProgress.cardsDrawn).toBe(playerCount);
      expect(advancedProgress.cardsRemaining).toBe(
        ordinaryCardCount(playerCount) - playerCount,
      );
      expect(advancedProgress.lastAttempt?.cards).toHaveLength(playerCount);
      expect(advancedProgress.lastAttempt?.seatDraws.map(({ seat }) => seat)).toEqual(
        Array.from({ length: playerCount }, (_, seat) => seat),
      );
      expect(advancedProgress.winnerSeat).toBe(advanced.session.winnerSeat);
      expect(advancedProgress.phase).toBe(advanced.phase);

      const complete = completeOpeningDrawMachine(advanced);
      const completeProgress = openingDrawMachineProgress(complete);

      expect(completeProgress.phase).toBe("complete");
      expect(completeProgress.winnerSeat).not.toBeNull();
      expect(completeProgress.attemptsCompleted).toBe(
        complete.session.attempts.length,
      );
      expect(completeProgress.cardsDrawn).toBe(
        complete.session.attempts.length * playerCount,
      );
      expect(completeProgress.cardsRemaining).toBe(
        ordinaryCardCount(playerCount) - completeProgress.cardsDrawn,
      );
      expect(completeProgress.lastAttempt?.winnerSeat).toBe(
        completeProgress.winnerSeat,
      );
    });
  }
});
