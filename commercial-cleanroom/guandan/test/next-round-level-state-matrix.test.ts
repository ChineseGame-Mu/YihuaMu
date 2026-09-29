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

const completedRound = (
  playerCount: (typeof SUPPORTED_PLAYER_COUNTS)[number],
): TableRoundState => {
  const playing = completeTableOpeningDraw(
    createTableRoundState(openingDeck(playerCount), playerCount, KEEP_ORDER),
  );
  return {
    ...playing,
    phase: "round-complete",
    activeSeats: [playerCount - 1],
    finishingOrder: Array.from({ length: playerCount }, (_, seat) => seat),
  };
};

describe("next-round level state boundary", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "keeps the prior winner on lead and applies the next level for %i players",
    (playerCount) => {
      const next = startNextTableRound(completedRound(playerCount), "7");

      expect(next.phase).toBe("playing");
      expect(next.levelRank).toBe("7");
      expect(next.activeSeats).toEqual(
        Array.from({ length: playerCount }, (_, seat) => seat),
      );
      expect(next.finishingOrder).toEqual([]);
      expect(next.trick?.leaderSeat).toBe(0);
      expect(next.trick?.currentTurn).toBe(0);
      expect(next.trick?.leadingPlay).toBeNull();

      const aceLead = playTableCards(next, 0, [suited("A")]);
      const levelBeat = playTableCards(aceLead, 1, [suited("7", "spades")]);

      expect(levelBeat.levelRank).toBe("7");
      expect(levelBeat.trick?.leadingPlay?.seat).toBe(1);
      expect(levelBeat.trick?.leadingPlay?.hand.kind).toBe("single");
      expect(levelBeat.trick?.currentTurn).toBe(2 % playerCount);
    },
  );

  it("preserves the current level when the next round does not override it", () => {
    const completed = { ...completedRound(4), levelRank: "9" as const };
    const next = startNextTableRound(completed);

    expect(next.levelRank).toBe("9");
  });
});
