import { describe, expect, it } from "vitest";
import type { Card, Rank } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  completeTableOpeningDraw,
  createTableRoundState,
  passTableTurn,
  playTableCards,
  playTableCardsWithLevel,
} from "../src/core/table-state-machine.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const PLAYER_COUNTS: readonly SupportedPlayerCount[] = [4, 6, 8, 10, 12, 14];
const KEEP_ORDER = (): number => 0.999999;

const card = (
  rank: Rank,
  suit: "clubs" | "diamonds" | "hearts" | "spades" = "clubs",
): Card => ({ kind: "suited", rank, suit });

const openingDeck = (playerCount: SupportedPlayerCount): DeckCard[] =>
  Array.from({ length: playerCount }, (_, seat) => ({
    id: `opening:${seat}`,
    copy: 0,
    card: card(seat === 0 ? "A" : "3", seat === 0 ? "hearts" : "clubs"),
  }));

describe("opening winner finish hands lead to the nearest teammate", () => {
  it.each(PLAYER_COUNTS)(
    "%i players preserves the level and gives the catch lead to seat 2",
    (playerCount) => {
      let state = completeTableOpeningDraw(
        createTableRoundState(openingDeck(playerCount), playerCount, KEEP_ORDER),
      );

      expect(state.openingDraw.winnerSeat).toBe(0);
      expect(state.trick?.currentTurn).toBe(0);

      state = playTableCardsWithLevel(
        state,
        0,
        [card("A")],
        "7",
        { finishesHand: true },
      );

      expect(state.finishingOrder).toEqual([0]);
      expect(state.activeSeats).not.toContain(0);
      expect(state.levelRank).toBe("7");

      for (let seat = 1; seat < playerCount; seat += 2) {
        state = passTableTurn(state, seat);
      }

      expect(state.trick?.leadingPlay).toBeNull();
      expect(state.trick?.currentTurn).toBe(2);
      expect(state.levelRank).toBe("7");

      state = playTableCards(state, 2, [card("7", "hearts")]);
      expect(state.trick?.leadingPlay).toMatchObject({
        seat: 2,
        hand: { kind: "single", rank: "7" },
      });
    },
  );
});
