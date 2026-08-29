import { describe, expect, it } from "vitest";
import { createDeck, dealHands } from "../src/core/deck.js";
import { playGameCards, type PlayingState } from "../src/core/game-state.js";
import { createTableConfig, type SupportedPlayerCount } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const PLAYER_COUNTS = [4, 6, 8, 10, 12, 14] as const;

describe("finished seat guards", () => {
  it.each(PLAYER_COUNTS)(
    "rejects any play from a finished seat for %i players",
    (playerCount: SupportedPlayerCount) => {
      const hands = dealHands(createDeck(playerCount), playerCount);
      const trick = createTrickState(playerCount, 0);
      const state: PlayingState = {
        phase: "playing",
        config: createTableConfig(playerCount, 0),
        openingDraw: { attempts: [], winnerSeat: 0 },
        hands,
        currentTurn: 0,
        trick,
        finishedSeats: [0],
      };

      expect(() => playGameCards(state, 0, [hands[0]![0]!.card])).toThrow(
        "finished seat cannot play",
      );
      expect(state.hands[0]).toHaveLength(27);
      expect(state.finishedSeats).toEqual([0]);
      expect(state.trick.currentTurn).toBe(0);
    },
  );
});
