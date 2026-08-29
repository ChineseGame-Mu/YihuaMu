import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import { createTrickState, passTurn, playCards } from "../src/core/trick-state.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const PLAYER_COUNTS = [4, 6, 8, 10, 12, 14] as const;
const three: Card = { kind: "suited", suit: "clubs", rank: "3" };

describe("active-seat trick rotation", () => {
  it.each(PLAYER_COUNTS)(
    "skips inactive seats and counts passes only from active opponents for %i players",
    (playerCount: SupportedPlayerCount) => {
      const activeSeats = [0, 2];
      let state = createTrickState(playerCount, 0);

      state = playCards(state, 0, [three], activeSeats);
      expect(state.currentTurn).toBe(2);

      state = passTurn(state, 2, activeSeats);
      expect(state.leadingPlay).toBeNull();
      expect(state.currentTurn).toBe(0);
      expect(state.leaderSeat).toBe(0);
      expect(state.completedTricks).toBe(1);
      expect(state.passedSeats).toEqual([]);
    },
  );

  it.each(PLAYER_COUNTS)(
    "hands the next trick to the next active seat when the winning seat is inactive for %i players",
    (playerCount: SupportedPlayerCount) => {
      let state = createTrickState(playerCount, 0);
      state = playCards(state, 0, [three]);

      const activeSeats = [1, 2];
      state = passTurn(state, 1, activeSeats);
      state = passTurn(state, 2, activeSeats);

      expect(state.leadingPlay).toBeNull();
      expect(state.currentTurn).toBe(1);
      expect(state.leaderSeat).toBe(1);
      expect(state.completedTricks).toBe(1);
      expect(state.passedSeats).toEqual([]);
    },
  );
});
