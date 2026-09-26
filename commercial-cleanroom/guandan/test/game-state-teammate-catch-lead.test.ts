import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  passGameTurn,
  playGameCards,
  type PlayingState,
} from "../src/core/game-state.js";
import { createTableConfig } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const card = (seat: number, rank: "3" | "4"): DeckCard => ({
  id: `seat-${seat}-${rank}`,
  copy: 0,
  card: { kind: "suited", suit: "clubs", rank },
});

const playingState = (
  playerCount: 4 | 6 | 8 | 10 | 12 | 14,
  finishedSeats: readonly number[] = [],
): PlayingState => {
  const hands = Array.from({ length: playerCount }, (_, seat) =>
    finishedSeats.includes(seat) ? [] : [card(seat, seat === 0 ? "3" : "4")],
  );
  return {
    phase: "playing",
    config: createTableConfig(playerCount, 0),
    openingDraw: { attempts: [], winnerSeat: 0 },
    hands,
    currentTurn: 0,
    trick: createTrickState(playerCount, 0),
    finishedSeats,
  };
};

const asCard = (deckCard: DeckCard): Card => deckCard.card;

describe("game-state teammate catch lead", () => {
  it.each([4, 6, 8, 10, 12, 14] as const)(
    "hands the next trick to the nearest active teammate after seat 0 finishes at a %i-player table",
    (playerCount) => {
      let state = playGameCards(playingState(playerCount), 0, [
        asCard(card(0, "3")),
      ]);
      expect(state.phase).toBe("playing");
      if (state.phase !== "playing") return;

      for (let seat = 1; seat < playerCount; seat += 2) {
        state = passGameTurn(state, seat);
      }

      expect(state.trick.leadingPlay).toBeNull();
      expect(state.trick.leaderSeat).toBe(2);
      expect(state.currentTurn).toBe(2);
      expect(state.trick.completedTricks).toBe(1);
    },
  );

  it("skips an already-finished teammate and catches the lead with the next active teammate", () => {
    let state = playGameCards(playingState(6, [2]), 0, [asCard(card(0, "3"))]);
    expect(state.phase).toBe("playing");
    if (state.phase !== "playing") return;

    state = passGameTurn(state, 1);
    state = passGameTurn(state, 3);
    state = passGameTurn(state, 5);

    expect(state.trick.leadingPlay).toBeNull();
    expect(state.trick.leaderSeat).toBe(4);
    expect(state.currentTurn).toBe(4);
  });
});
