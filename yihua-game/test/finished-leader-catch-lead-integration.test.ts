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

const card = (rank: "3" | "4" | "5", suit: "clubs" | "diamonds" = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const deckCard = (id: string, value: Card): DeckCard => ({ id, copy: 0, card: value });

const makeState = (playerCount: SupportedPlayerCount): PlayingState => ({
  phase: "playing",
  config: createTableConfig(playerCount, 0),
  openingDraw: { attempts: [], winnerSeat: 1 },
  hands: Array.from({ length: playerCount }, (_, seat) =>
    seat === 1
      ? [deckCard("leader-last", card("3"))]
      : [deckCard(`seat-${seat}-a`, card("4")), deckCard(`seat-${seat}-b`, card("5"))],
  ),
  currentTurn: 1,
  trick: createTrickState(playerCount, 1),
  finishedSeats: [],
});

describe("finished leader catch-lead integration", () => {
  it.each([4, 6, 8, 10, 12, 14] as const)(
    "hands a cleared trick to the nearest active teammate for %i players",
    (playerCount) => {
      let state = playGameCards(makeState(playerCount), 1, [card("3")]);
      expect(state.phase).toBe("playing");
      if (state.phase !== "playing") throw new Error("expected playing");

      const opponents = Array.from(
        { length: playerCount / 2 },
        (_, index) => (2 + index * 2) % playerCount,
      );
      for (const seat of opponents) {
        expect(state.currentTurn).toBe(seat);
        state = passGameTurn(state, seat);
      }

      expect(state.finishedSeats).toEqual([1]);
      expect(state.trick.leadingPlay).toBeNull();
      expect(state.trick.completedTricks).toBe(1);
      expect(state.trick.leaderSeat).toBe(3);
      expect(state.currentTurn).toBe(3);
    },
  );

  it("allows the caught teammate to lead a fresh hand after the prior leader finished", () => {
    let state = playGameCards(makeState(4), 1, [card("3")]);
    if (state.phase !== "playing") throw new Error("expected playing");
    state = passGameTurn(state, 2);
    state = passGameTurn(state, 0);

    const next = playGameCards(state, 3, [card("4")]);
    expect(next.phase).toBe("playing");
    if (next.phase !== "playing") throw new Error("expected playing");
    expect(next.trick.leadingPlay?.seat).toBe(3);
    expect(next.trick.leadingPlay?.hand.kind).toBe("single");
    expect(next.currentTurn).toBe(0);
    expect(next.finishedSeats).toEqual([1]);
  });
});
