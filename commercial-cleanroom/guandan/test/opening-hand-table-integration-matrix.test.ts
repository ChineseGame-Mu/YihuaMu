import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import { createDeck } from "../src/core/deck.js";
import {
  completeTableOpeningDraw,
  createTableRoundState,
  playTableCardsWithLevel,
} from "../src/core/table-state-machine.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const PLAYER_COUNTS: readonly SupportedPlayerCount[] = [4, 6, 8, 10, 12, 14];
const fixedRandom = () => 0;

const wildcardPair: readonly Card[] = [
  { kind: "suited", suit: "spades", rank: "9" },
  { kind: "suited", suit: "hearts", rank: "7" },
];

describe("opening draw -> level hand -> table state integration", () => {
  it.each(PLAYER_COUNTS)(
    "atomically completes the opening draw and lets its winner lead a level-aware pair for %i players",
    (playerCount) => {
      const opening = createTableRoundState(
        createDeck(playerCount),
        playerCount,
        fixedRandom,
      );
      expect(opening.phase).toBe("opening-draw");
      expect(opening.trick).toBeNull();

      const playing = completeTableOpeningDraw(opening);
      expect(playing.phase).toBe("playing");
      expect(playing.openingDraw.attempts.length).toBeGreaterThan(0);

      const winnerSeat = playing.openingDraw.winnerSeat;
      expect(winnerSeat).not.toBeNull();
      if (winnerSeat === null || playing.trick === null) {
        throw new Error("completed opening draw must create a playing trick");
      }

      expect(playing.trick.leaderSeat).toBe(winnerSeat);
      expect(playing.trick.currentTurn).toBe(winnerSeat);
      expect(playing.trick.leadingPlay).toBeNull();

      const afterLead = playTableCardsWithLevel(
        playing,
        winnerSeat,
        wildcardPair,
        "7",
      );
      expect(afterLead.phase).toBe("playing");
      expect(afterLead.trick?.leaderSeat).toBe(winnerSeat);
      expect(afterLead.trick?.leadingPlay?.seat).toBe(winnerSeat);
      expect(afterLead.trick?.leadingPlay?.hand).toMatchObject({
        kind: "pair",
        size: 2,
        rank: "9",
      });
      expect(afterLead.trick?.passedSeats).toEqual([]);
      expect(afterLead.trick?.currentTurn).toBe((winnerSeat + 1) % playerCount);

      expect(() => completeTableOpeningDraw(playing)).toThrow(
        /opening draw is already complete/,
      );
    },
  );
});
