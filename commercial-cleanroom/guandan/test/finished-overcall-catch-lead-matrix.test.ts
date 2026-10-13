import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import {
  passTableTurn,
  playTableCards,
  type TableRoundState,
} from "../src/core/table-state-machine.js";
import type { SupportedPlayerCount } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const card = (rank: "3" | "4"): Card => ({
  kind: "suited",
  rank,
  suit: "clubs",
});

const playingState = (playerCount: SupportedPlayerCount): TableRoundState => ({
  playerCount,
  levelRank: "2",
  phase: "playing",
  openingDraw: { remainingCards: [], attempts: [], winnerSeat: 0 },
  trick: createTrickState(playerCount, 0),
  activeSeats: Array.from({ length: playerCount }, (_, seat) => seat),
  finishingOrder: [],
});

describe("chained finished overcall catch lead", () => {
  it.each([4, 6, 8, 10, 12, 14] as const)(
    "hands the cleared trick to the overcall winner's nearest active teammate for %i players",
    (playerCount) => {
      let state = playTableCards(playingState(playerCount), 0, [card("3")], {
        finishesHand: true,
      });

      expect(state.trick?.currentTurn).toBe(1);
      expect(state.finishingOrder).toEqual([0]);

      state = playTableCards(state, 1, [card("4")], {
        finishesHand: true,
      });

      expect(state.finishingOrder).toEqual([0, 1]);
      expect(state.trick?.leadingPlay?.seat).toBe(1);
      expect(state.trick?.passedSeats).toEqual([]);
      expect(state.trick?.currentTurn).toBe(2);

      const responders = Array.from(
        { length: playerCount / 2 - 1 },
        (_, index) => 2 + index * 2,
      );
      for (const seat of responders) {
        expect(state.trick?.currentTurn).toBe(seat);
        state = passTableTurn(state, seat);
      }

      expect(state.phase).toBe("playing");
      expect(state.trick?.leadingPlay).toBeNull();
      expect(state.trick?.completedTricks).toBe(1);
      expect(state.trick?.leaderSeat).toBe(3);
      expect(state.trick?.currentTurn).toBe(3);
      expect(state.activeSeats).not.toContain(0);
      expect(state.activeSeats).not.toContain(1);
    },
  );
});
