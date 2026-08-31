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

describe("table level rank survives a completed pass cycle", () => {
  it.each(PLAYER_COUNTS)(
    "%i players keeps an explicit later-round level after the trick resets",
    (playerCount) => {
      let state = completeTableOpeningDraw(
        createTableRoundState(openingDeck(playerCount), playerCount, KEEP_ORDER),
      );

      state = playTableCardsWithLevel(state, 0, [card("A")], "7");
      state = playTableCards(state, 1, [card("7", "spades")]);

      for (let seat = 2; seat < playerCount; seat += 1) {
        state = passTableTurn(state, seat);
      }
      state = passTableTurn(state, 0);

      expect(state.levelRank).toBe("7");
      expect(state.trick?.leadingPlay).toBeNull();
      expect(state.trick?.currentTurn).toBe(1);

      state = playTableCards(state, 1, [card("7", "hearts")]);
      expect(state.trick?.leadingPlay).toMatchObject({
        seat: 1,
        hand: { kind: "single", rank: "7" },
      });
    },
  );
});
