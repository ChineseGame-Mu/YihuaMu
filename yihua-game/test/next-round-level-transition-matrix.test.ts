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

const suited = (
  rank: Rank,
  suit: "clubs" | "diamonds" | "hearts" | "spades" = "clubs",
): Card => ({ kind: "suited", rank, suit });

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
  const finishingOrder = Array.from({ length: playerCount }, (_, seat) => seat);

  return {
    ...playing,
    phase: "round-complete",
    activeSeats: [playerCount - 1],
    finishingOrder,
  };
};

describe("next-round level transition matrix", () => {
  it.each(PLAYER_COUNTS)(
    "%i players resets the table around the prior winner and applies the new level immediately",
    (playerCount) => {
      const nextRound = startNextTableRound(completedRound(playerCount), "7");

      expect(nextRound.phase).toBe("playing");
      expect(nextRound.levelRank).toBe("7");
      expect(nextRound.activeSeats).toEqual(
        Array.from({ length: playerCount }, (_, seat) => seat),
      );
      expect(nextRound.finishingOrder).toEqual([]);
      expect(nextRound.trick?.leaderSeat).toBe(0);
      expect(nextRound.trick?.currentTurn).toBe(0);
      expect(nextRound.trick?.leadingPlay).toBeNull();
      expect(nextRound.trick?.passedSeats).toEqual([]);

      const aceLead = playTableCards(nextRound, 0, [suited("A", "spades")]);
      expect(aceLead.trick?.leadingPlay?.seat).toBe(0);
      expect(aceLead.trick?.leadingPlay?.hand.kind).toBe("single");
      expect(aceLead.trick?.currentTurn).toBe(1);

      const levelBeat = playTableCards(aceLead, 1, [suited("7", "diamonds")]);
      expect(levelBeat.levelRank).toBe("7");
      expect(levelBeat.trick?.leadingPlay?.seat).toBe(1);
      expect(levelBeat.trick?.leadingPlay?.hand.kind).toBe("single");
      expect(levelBeat.trick?.currentTurn).toBe(2 % playerCount);
    },
  );
});
