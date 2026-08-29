import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import {
  createTrickState,
  passTurn,
  playCards,
} from "../src/core/trick-state.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const PLAYER_COUNTS = [4, 6, 8, 10, 12, 14] as const;
const three: Card = { kind: "suited", suit: "clubs", rank: "3" };

describe("trick turn guard matrix", () => {
  it.each(PLAYER_COUNTS)(
    "rejects out-of-turn play and pass for %i players without mutating state",
    (playerCount: SupportedPlayerCount) => {
      const initial = createTrickState(playerCount, 0);
      const snapshot = structuredClone(initial);

      expect(() => playCards(initial, 1, [three])).toThrow(
        "not this seat's turn",
      );
      expect(() => passTurn(initial, 1)).toThrow("not this seat's turn");
      expect(initial).toEqual(snapshot);
    },
  );

  it.each(PLAYER_COUNTS)(
    "rejects a leader pass before any cards are led for %i players",
    (playerCount: SupportedPlayerCount) => {
      const initial = createTrickState(playerCount, 0);
      const snapshot = structuredClone(initial);

      expect(() => passTurn(initial, 0)).toThrow("leader cannot pass");
      expect(initial).toEqual(snapshot);
    },
  );

  it.each(PLAYER_COUNTS)(
    "rejects a non-beating response without advancing the turn for %i players",
    (playerCount: SupportedPlayerCount) => {
      const five: Card = { kind: "suited", suit: "clubs", rank: "5" };
      let state = createTrickState(playerCount, 0);
      state = playCards(state, 0, [five]);
      const snapshot = structuredClone(state);

      expect(() => playCards(state, 1, [three])).toThrow(
        "played hand does not beat the current hand",
      );
      expect(state).toEqual(snapshot);
      expect(state.currentTurn).toBe(1);
    },
  );
});
