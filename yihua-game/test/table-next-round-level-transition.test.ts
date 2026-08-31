import { describe, expect, it } from "vitest";
import type { Card, Rank } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  completeTableOpeningDraw,
  createTableRoundState,
  playTableCards,
  startNextTableRound,
  type TableRoundState,
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

describe("next table round level transition", () => {
  it.each(PLAYER_COUNTS)(
    "%i players keeps the first opening draw while accepting the promoted level",
    (playerCount) => {
      const firstRound = completeTableOpeningDraw(
        createTableRoundState(openingDeck(playerCount), playerCount, KEEP_ORDER),
      );
      const winnerSeat = 1;
      const finishingOrder = [
        winnerSeat,
        ...Array.from({ length: playerCount }, (_, seat) => seat).filter(
          (seat) => seat !== winnerSeat,
        ),
      ];
      const completed: TableRoundState = {
        ...firstRound,
        phase: "round-complete",
        activeSeats: [finishingOrder[finishingOrder.length - 1]!],
        finishingOrder,
      };
      const openingDraw = completed.openingDraw;

      let nextRound = startNextTableRound(completed, "9");

      expect(nextRound.phase).toBe("playing");
      expect(nextRound.levelRank).toBe("9");
      expect(nextRound.openingDraw).toBe(openingDraw);
      expect(nextRound.trick?.leaderSeat).toBe(winnerSeat);
      expect(nextRound.trick?.currentTurn).toBe(winnerSeat);
      expect(nextRound.activeSeats).toHaveLength(playerCount);
      expect(nextRound.finishingOrder).toEqual([]);

      nextRound = playTableCards(nextRound, winnerSeat, [card("A")]);
      const responder = (winnerSeat + 1) % playerCount;
      nextRound = playTableCards(nextRound, responder, [card("9", "spades")]);

      expect(nextRound.trick?.leadingPlay).toMatchObject({
        seat: responder,
        hand: { kind: "single", rank: "9" },
      });
      expect(nextRound.levelRank).toBe("9");
    },
  );
});
