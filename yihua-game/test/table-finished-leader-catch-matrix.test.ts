import { describe, expect, it } from "vitest";
import type { Card, Rank } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  completeTableOpeningDraw,
  createTableRoundState,
  passTableTurn,
  playTableCards,
} from "../src/core/table-state-machine.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const PLAYER_COUNTS: readonly SupportedPlayerCount[] = [4, 6, 8, 10, 12, 14];
const KEEP_ORDER = (): number => 0.999999;

const card = (
  rank: Rank,
  suit: "clubs" | "diamonds" | "hearts" | "spades",
): Card => ({
  kind: "suited",
  rank,
  suit,
});

const openingDeck = (playerCount: SupportedPlayerCount): DeckCard[] =>
  Array.from({ length: playerCount }, (_, seat) => ({
    id: `opening:${seat}`,
    copy: 0,
    card: card(seat === 0 ? "A" : "3", seat === 0 ? "hearts" : "clubs"),
  }));

describe("finished leader teammate catch matrix", () => {
  it.each(PLAYER_COUNTS)(
    "%i players gives the next trick to the nearest active teammate after opponents pass",
    (playerCount) => {
      const playing = completeTableOpeningDraw(
        createTableRoundState(openingDeck(playerCount), playerCount, KEEP_ORDER, "2"),
      );

      expect(playing.trick?.currentTurn).toBe(0);

      let state = playTableCards(playing, 0, [card("A", "clubs")], {
        finishesHand: true,
      });

      expect(state.finishingOrder).toEqual([0]);
      expect(state.activeSeats).not.toContain(0);
      expect(state.trick?.leadingPlay?.seat).toBe(0);

      const opposingSeats = Array.from(
        { length: playerCount / 2 },
        (_, index) => index * 2 + 1,
      );

      for (const seat of opposingSeats) {
        expect(state.trick?.currentTurn).toBe(seat);
        state = passTableTurn(state, seat);
      }

      expect(state.trick?.leadingPlay).toBeNull();
      expect(state.trick?.leaderSeat).toBe(2);
      expect(state.trick?.currentTurn).toBe(2);
      expect(state.trick?.completedTricks).toBe(1);
      expect(state.levelRank).toBe("2");
    },
  );
});
