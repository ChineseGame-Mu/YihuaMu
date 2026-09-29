import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
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

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const openingDeck = (playerCount: SupportedPlayerCount): DeckCard[] =>
  Array.from({ length: playerCount }, (_, seat) => ({
    id: `opening:${seat}`,
    copy: 0,
    card: suited(seat === 0 ? "A" : "3", seat === 0 ? "hearts" : "clubs"),
  }));

describe("next-round table leader and level state", () => {
  it.each(PLAYER_COUNTS)(
    "%i players carries the new level rank and first-place lead into the next round",
    (playerCount) => {
      const playing = completeTableOpeningDraw(
        createTableRoundState(
          openingDeck(playerCount),
          playerCount,
          KEEP_ORDER,
        ),
      );
      const firstPlaceSeat = Math.min(2, playerCount - 1);
      const finishingOrder = [
        firstPlaceSeat,
        ...Array.from({ length: playerCount }, (_, seat) => seat).filter(
          (seat) => seat !== firstPlaceSeat,
        ),
      ];
      const completed: TableRoundState = {
        ...playing,
        phase: "round-complete",
        activeSeats: [finishingOrder[finishingOrder.length - 1]!],
        finishingOrder,
      };

      const nextRound = startNextTableRound(completed, "7");

      expect(nextRound.phase).toBe("playing");
      expect(nextRound.levelRank).toBe("7");
      expect(nextRound.activeSeats).toHaveLength(playerCount);
      expect(nextRound.finishingOrder).toEqual([]);
      expect(nextRound.trick?.leaderSeat).toBe(firstPlaceSeat);
      expect(nextRound.trick?.currentTurn).toBe(firstPlaceSeat);

      const aceLead = playTableCards(nextRound, firstPlaceSeat, [suited("A")]);
      const responder = (firstPlaceSeat + 1) % playerCount;
      const levelBeat = playTableCards(aceLead, responder, [
        suited("7", "spades"),
      ]);

      expect(levelBeat.levelRank).toBe("7");
      expect(levelBeat.trick?.leadingPlay).toMatchObject({
        seat: responder,
        hand: { kind: "single", rank: "7" },
      });
    },
  );
});
