import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  passGameTurn,
  playGameCards,
  type PlayingState,
} from "../src/core/game-state.js";
import {
  createTableConfig,
  type SupportedPlayerCount,
} from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const three: Card = { kind: "suited", rank: "3", suit: "clubs" };
const four: Card = { kind: "suited", rank: "4", suit: "clubs" };

const deckCard = (id: string, card: Card): DeckCard => ({ id, copy: 0, card });

const makeState = (playerCount: SupportedPlayerCount): PlayingState => ({
  phase: "playing",
  config: createTableConfig(playerCount, 0),
  openingDraw: { attempts: [], winnerSeat: 1 },
  hands: Array.from({ length: playerCount }, (_, seat) =>
    seat === 1
      ? [deckCard(`seat-${seat}-lead`, three)]
      : [deckCard(`seat-${seat}-a`, four), deckCard(`seat-${seat}-b`, four)],
  ),
  currentTurn: 1,
  trick: createTrickState(playerCount, 1),
  finishedSeats: [],
});

describe("teammate catch-lead matrix", () => {
  it.each([4, 6, 8, 10, 12, 14] as const)(
    "lets the nearest active teammate catch a finished leader for %i players",
    (playerCount) => {
      const afterLead = playGameCards(makeState(playerCount), 1, [three]);
      expect(afterLead.phase).toBe("playing");
      if (afterLead.phase !== "playing") throw new Error("expected playing");
      expect(afterLead.finishedSeats).toEqual([1]);
      expect(afterLead.currentTurn).toBe(2);

      let state = afterLead;
      const opponentSeats = Array.from(
        { length: playerCount / 2 },
        (_, index) => (2 + index * 2) % playerCount,
      );
      for (const seat of opponentSeats) {
        expect(state.currentTurn).toBe(seat);
        state = passGameTurn(state, seat);
      }

      expect(state.trick.leadingPlay).toBeNull();
      expect(state.trick.leaderSeat).toBe(3);
      expect(state.currentTurn).toBe(3);
      expect(state.finishedSeats).toEqual([1]);
    },
  );
});
