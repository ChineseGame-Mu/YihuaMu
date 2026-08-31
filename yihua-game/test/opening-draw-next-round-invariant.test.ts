import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  completeTableOpeningDraw,
  createTableRoundState,
  startNextTableRound,
  type TableRoundState,
} from "../src/core/table-state-machine.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

const KEEP_ORDER = (): number => 0.999999;
const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const openingDeck = (playerCount: number): DeckCard[] =>
  Array.from({ length: playerCount }, (_, seat) => ({
    id: `opening:${seat}`,
    copy: 0,
    card: suited(seat === 0 ? "A" : "3", seat === 0 ? "hearts" : "clubs"),
  }));

describe("opening draw is first-round-only", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "keeps the original draw record but starts the next round from the prior winner at %i players",
    (playerCount) => {
      const firstRound = completeTableOpeningDraw(
        createTableRoundState(openingDeck(playerCount), playerCount, KEEP_ORDER),
      );
      expect(firstRound.openingDraw.winnerSeat).toBe(0);

      const priorWinner = playerCount > 4 ? 2 : 1;
      const finishingOrder = [
        priorWinner,
        ...Array.from({ length: playerCount }, (_, seat) => seat).filter(
          (seat) => seat !== priorWinner,
        ),
      ];
      const completed: TableRoundState = {
        ...firstRound,
        phase: "round-complete",
        activeSeats: [finishingOrder[finishingOrder.length - 1]!],
        finishingOrder,
      };

      const next = startNextTableRound(completed, "7");

      expect(next.phase).toBe("playing");
      expect(next.openingDraw).toEqual(firstRound.openingDraw);
      expect(next.openingDraw.winnerSeat).toBe(0);
      expect(next.trick?.leaderSeat).toBe(priorWinner);
      expect(next.trick?.currentTurn).toBe(priorWinner);
      expect(next.trick?.completedTricks).toBe(0);
      expect(next.trick?.leadingPlay).toBeNull();
      expect(next.levelRank).toBe("7");
    },
  );
});
