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

const makeState = (playerCount: SupportedPlayerCount): PlayingState => {
  const hands = Array.from({ length: playerCount }, (_, seat) => {
    if (seat === 1) return [deckCard("leader-last", three)];
    if (seat === 3) return [];
    return [deckCard(`seat-${seat}-a`, four), deckCard(`seat-${seat}-b`, four)];
  });

  return {
    phase: "playing",
    config: createTableConfig(playerCount, 0),
    openingDraw: { attempts: [], winnerSeat: 1 },
    hands,
    currentTurn: 1,
    trick: createTrickState(playerCount, 1),
    finishedSeats: [3],
  };
};

describe("catch lead skips finished teammates", () => {
  it.each([6, 8, 10, 12, 14] as const)(
    "hands the lead to the next active teammate for %i players",
    (playerCount) => {
      const afterLead = playGameCards(makeState(playerCount), 1, [three]);
      expect(afterLead.phase).toBe("playing");
      if (afterLead.phase !== "playing") throw new Error("expected playing");
      expect(afterLead.finishedSeats).toEqual([3, 1]);

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
      expect(state.trick.leaderSeat).toBe(5);
      expect(state.currentTurn).toBe(5);
      expect(state.finishedSeats).toEqual([3, 1]);
    },
  );
});
