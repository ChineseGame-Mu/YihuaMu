import { describe, expect, it } from "vitest";
import type { DeckCard } from "../src/core/deck.js";
import {
  advanceOpeningDrawMachine,
  createOpeningDrawMachine,
  openingDrawMachinePrompt,
} from "../src/core/opening-draw-machine.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const PLAYER_COUNTS: readonly SupportedPlayerCount[] = [4, 6, 8, 10, 12, 14];
const KEEP_ORDER = (): number => 0.999999;

const suitedCard = (
  id: string,
  rank: "3" | "A",
  suit: "clubs" | "hearts",
): DeckCard => ({
  id,
  copy: 0,
  card: { kind: "suited", rank, suit },
});

const retryDeck = (playerCount: SupportedPlayerCount): DeckCard[] => {
  const tiedAttempt = Array.from({ length: playerCount }, (_, seat) =>
    suitedCard(`tie:${seat}`, "A", "clubs"),
  );
  const decidingAttempt = Array.from({ length: playerCount }, (_, seat) =>
    suitedCard(
      `decide:${seat}`,
      seat === playerCount - 1 ? "A" : "3",
      seat === playerCount - 1 ? "hearts" : "clubs",
    ),
  );
  return [...tiedAttempt, ...decidingAttempt];
};

describe("opening draw prompt lifecycle", () => {
  it.each(PLAYER_COUNTS)(
    "describes first draw, redraw, and completion for %i players",
    (playerCount) => {
      const initial = createOpeningDrawMachine(
        retryDeck(playerCount),
        playerCount,
        KEEP_ORDER,
      );

      expect(openingDrawMachinePrompt(initial)).toEqual({
        phase: "drawing",
        canDraw: true,
        attemptNumber: 1,
        isRedraw: false,
        seatsToDraw: Array.from({ length: playerCount }, (_, seat) => seat),
        cardsRequired: playerCount,
      });

      const tied = advanceOpeningDrawMachine(initial);
      expect(tied.session.winnerSeat).toBeNull();
      expect(openingDrawMachinePrompt(tied)).toEqual({
        phase: "drawing",
        canDraw: true,
        attemptNumber: 2,
        isRedraw: true,
        seatsToDraw: Array.from({ length: playerCount }, (_, seat) => seat),
        cardsRequired: playerCount,
      });

      const complete = advanceOpeningDrawMachine(tied);
      expect(complete.session.winnerSeat).toBe(playerCount - 1);
      expect(openingDrawMachinePrompt(complete)).toEqual({
        phase: "complete",
        canDraw: false,
        attemptNumber: null,
        isRedraw: false,
        seatsToDraw: [],
        cardsRequired: 0,
      });
    },
  );
});
