import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  completeTableOpeningDraw,
  createTableRoundState,
  passTableTurn,
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

const completedRound = (playerCount: SupportedPlayerCount): TableRoundState => {
  const playing = completeTableOpeningDraw(
    createTableRoundState(openingDeck(playerCount), playerCount, KEEP_ORDER),
  );
  const winnerSeat = Math.min(2, playerCount - 1);
  const finishingOrder = [
    winnerSeat,
    ...Array.from({ length: playerCount }, (_, seat) => seat).filter(
      (seat) => seat !== winnerSeat,
    ),
  ];
  return {
    ...playing,
    phase: "round-complete",
    activeSeats: [finishingOrder[finishingOrder.length - 1]!],
    finishingOrder,
  };
};

describe("next-round trick continuity", () => {
  it.each(PLAYER_COUNTS)(
    "%i players preserves level comparison, closes the trick, and lets the winner lead again",
    (playerCount) => {
      const nextRound = startNextTableRound(completedRound(playerCount), "7");
      const firstSeat = nextRound.trick!.currentTurn;
      const firstLead = playTableCards(nextRound, firstSeat, [suited("A")]);
      const levelSeat = firstLead.trick!.currentTurn;
      let state = playTableCards(firstLead, levelSeat, [suited("7", "spades")]);

      expect(state.levelRank).toBe("7");
      expect(state.trick?.leadingPlay).toMatchObject({
        seat: levelSeat,
        hand: { kind: "single", rank: "7" },
      });

      while (state.trick?.leadingPlay !== null) {
        const seat = state.trick!.currentTurn;
        expect(seat).not.toBe(levelSeat);
        state = passTableTurn(state, seat);
      }

      expect(state.phase).toBe("playing");
      expect(state.levelRank).toBe("7");
      expect(state.trick?.completedTricks).toBe(1);
      expect(state.trick?.leaderSeat).toBe(levelSeat);
      expect(state.trick?.currentTurn).toBe(levelSeat);
      expect(state.trick?.passedSeats).toEqual([]);

      const secondLead = playTableCards(state, levelSeat, [suited("K")]);
      expect(secondLead.trick?.leadingPlay).toMatchObject({
        seat: levelSeat,
        hand: { kind: "single", rank: "K" },
      });
      expect(secondLead.trick?.currentTurn).toBe((levelSeat + 1) % playerCount);
      expect(secondLead.levelRank).toBe("7");
    },
  );
});
