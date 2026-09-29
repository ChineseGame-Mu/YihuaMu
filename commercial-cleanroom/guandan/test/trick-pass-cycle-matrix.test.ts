import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import {
  createTrickState,
  passTurn,
  playCards,
} from "../src/core/trick-state.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const PLAYER_COUNTS = [4, 6, 8, 10, 12, 14] as const;
type SuitedCard = Extract<Card, { readonly kind: "suited" }>;
const card = (
  rank: SuitedCard["rank"],
  suit: SuitedCard["suit"] = "clubs",
): Card => ({
  kind: "suited",
  rank,
  suit,
});

describe("trick pass cycle matrix", () => {
  it.each(PLAYER_COUNTS)(
    "returns the lead to the last winner after every opponent passes for %i players",
    (playerCount: SupportedPlayerCount) => {
      let state = createTrickState(playerCount, 0);
      state = playCards(state, 0, [card("3")]);
      expect(state.leadingPlay?.seat).toBe(0);

      for (let seat = 1; seat < playerCount; seat += 1) {
        state = passTurn(state, seat);
      }

      expect(state.leadingPlay).toBeNull();
      expect(state.currentTurn).toBe(0);
      expect(state.leaderSeat).toBe(0);
      expect(state.passedSeats).toEqual([]);
      expect(state.completedTricks).toBe(1);

      state = playCards(state, 0, [card("4")]);
      expect(state.leadingPlay?.seat).toBe(0);
      expect(state.currentTurn).toBe(1);
      expect(state.completedTricks).toBe(1);
    },
  );

  it.each(PLAYER_COUNTS)(
    "resets earlier passes when a later player takes the lead for %i players",
    (playerCount: SupportedPlayerCount) => {
      let state = createTrickState(playerCount, 0);
      state = playCards(state, 0, [card("3")]);
      state = passTurn(state, 1);
      expect(state.passedSeats).toEqual([1]);

      state = playCards(state, 2, [card("4")]);
      expect(state.leaderSeat).toBe(2);
      expect(state.leadingPlay?.seat).toBe(2);
      expect(state.passedSeats).toEqual([]);

      for (let offset = 1; offset < playerCount; offset += 1) {
        const seat = (2 + offset) % playerCount;
        state = passTurn(state, seat);
      }

      expect(state.leadingPlay).toBeNull();
      expect(state.currentTurn).toBe(2);
      expect(state.leaderSeat).toBe(2);
      expect(state.completedTricks).toBe(1);
    },
  );
});
