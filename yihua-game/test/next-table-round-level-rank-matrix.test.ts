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
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

const KEEP_ORDER = (): number => 0.999999;

const suited = (
  rank: Rank,
  suit: "clubs" | "diamonds" | "hearts" | "spades" = "clubs",
): Card => ({ kind: "suited", rank, suit });

const openingDeck = (playerCount: number): DeckCard[] =>
  Array.from({ length: playerCount }, (_, seat) => ({
    id: `opening:${seat}`,
    copy: 0,
    card: suited(seat === 0 ? "A" : "3", seat === 0 ? "hearts" : "clubs"),
  }));

const completedTable = (
  playerCount: (typeof SUPPORTED_PLAYER_COUNTS)[number],
  levelRank: Rank,
): TableRoundState => {
  const playing = completeTableOpeningDraw(
    createTableRoundState(openingDeck(playerCount), playerCount, KEEP_ORDER, levelRank),
  );
  return {
    ...playing,
    phase: "round-complete",
    activeSeats: [playerCount - 1],
    finishingOrder: Array.from({ length: playerCount }, (_, seat) => seat),
  };
};

describe("next table round level-rank transition", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "applies the next-round level before the first comparison for %i players",
    (playerCount) => {
      const completed = completedTable(playerCount, "2");
      let next = startNextTableRound(completed, "7");

      expect(next.phase).toBe("playing");
      expect(next.levelRank).toBe("7");
      expect(next.trick?.leaderSeat).toBe(0);
      expect(next.trick?.currentTurn).toBe(0);
      expect(next.activeSeats).toEqual(
        Array.from({ length: playerCount }, (_, seat) => seat),
      );
      expect(next.finishingOrder).toEqual([]);

      next = playTableCards(next, 0, [suited("A")]);
      next = playTableCards(next, 1, [suited("7", "spades")]);

      expect(next.trick?.leadingPlay?.seat).toBe(1);
      expect(next.trick?.leadingPlay?.hand).toMatchObject({
        kind: "single",
        rank: "7",
      });
      expect(next.levelRank).toBe("7");
    },
  );

  it("preserves the current level when the next round does not override it", () => {
    const next = startNextTableRound(completedTable(4, "9"));

    expect(next.levelRank).toBe("9");
  });
});
