import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  completeRound,
  passGameTurn,
  playGameCards,
  startNextRound,
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
const fixedRandom = () => 0.42;

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

describe("catch lead across the round boundary", () => {
  it.each([4, 6, 8, 10, 12, 14] as const)(
    "keeps catch-lead local to the current round and restores first-place lead next round for %i players",
    (playerCount) => {
      let state = playGameCards(makeState(playerCount), 1, [three]);
      expect(state.phase).toBe("playing");
      if (state.phase !== "playing") throw new Error("expected playing");

      const opponentSeats = Array.from(
        { length: playerCount / 2 },
        (_, index) => (2 + index * 2) % playerCount,
      );
      for (const seat of opponentSeats) state = passGameTurn(state, seat);

      expect(state.currentTurn).toBe(3);
      expect(state.trick.leaderSeat).toBe(3);

      const finishOrder = [
        1,
        ...Array.from({ length: playerCount - 1 }, (_, index) => (index + 2) % playerCount),
      ];
      const completed = completeRound(
        { ...state, finishedSeats: finishOrder },
        1,
      );
      expect(completed.outcome?.firstPlaceSeat).toBe(1);

      const next = startNextRound(completed, fixedRandom);
      expect(next.currentTurn).toBe(1);
      expect(next.trick.leaderSeat).toBe(1);
      expect(next.trick.leadingPlay).toBeNull();
      expect(next.finishedSeats).toEqual([]);
      expect(next.hands.every((hand) => hand.length === 27)).toBe(true);
      expect(next.openingDraw).toEqual(completed.openingDraw);
    },
  );
});
