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

const completedRound = (playerCount: SupportedPlayerCount): TableRoundState => {
  const playing = completeTableOpeningDraw(
    createTableRoundState(openingDeck(playerCount), playerCount, KEEP_ORDER, "5"),
  );
  const finishingOrder = Array.from({ length: playerCount }, (_, seat) => seat);

  return {
    ...playing,
    phase: "round-complete",
    activeSeats: [playerCount - 1],
    finishingOrder,
  };
};

describe("next-round table state and level-rank matrix", () => {
  it.each(PLAYER_COUNTS)(
    "%i players restarts from first place and applies the new level rank to later plays",
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

      const aceLead = playTableCards(next, 0, [card("A", "clubs")]);
      const levelBeat = playTableCards(aceLead, 1, [card("7", "spades")]);

      expect(levelBeat.levelRank).toBe("7");
      expect(levelBeat.trick?.leadingPlay?.seat).toBe(1);
      expect(levelBeat.trick?.leadingPlay?.hand.kind).toBe("single");
      expect(levelBeat.trick?.currentTurn).toBe(2 % playerCount);
    },
  );

  it("preserves the current level rank when the next round does not override it", () => {
    const next = startNextTableRound(completedRound(4));

    expect(next.levelRank).toBe("5");
  });
});
