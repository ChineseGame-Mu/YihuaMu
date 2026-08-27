import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  playGameCards,
  startNextRound,
  type PlayingState,
} from "../src/core/game-state.js";
import {
  createTableConfig,
  type SupportedPlayerCount,
} from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const lastCard: Card = { kind: "suited", rank: "3", suit: "clubs" };
const deckCard = (seat: number): DeckCard => ({
  id: `seat-${seat}-last`,
  copy: 0,
  card: lastCard,
});

const largeCounts: SupportedPlayerCount[] = [8, 10, 12, 14];

describe.each(largeCounts)("%i-player round completion", (playerCount) => {
  it("auto-fills last place and starts the next round from first place", () => {
    const penultimateSeat = playerCount - 2;
    const lastSeat = playerCount - 1;
    const firstPlaceSeat = 0;
    const finishedSeats = Array.from(
      { length: playerCount - 2 },
      (_, index) => index,
    );
    const hands = Array.from({ length: playerCount }, (_, seat) =>
      seat === penultimateSeat || seat === lastSeat ? [deckCard(seat)] : [],
    );
    const state: PlayingState = {
      phase: "playing",
      config: createTableConfig(playerCount, 0),
      openingDraw: { attempts: [], winnerSeat: firstPlaceSeat },
      hands,
      currentTurn: penultimateSeat,
      trick: createTrickState(playerCount, penultimateSeat),
      finishedSeats,
    };

    const completed = playGameCards(state, penultimateSeat, [lastCard]);
    expect(completed.phase).toBe("round-complete");
    if (completed.phase !== "round-complete") {
      throw new Error("expected round completion");
    }

    expect(completed.finishedSeats).toEqual([
      ...finishedSeats,
      penultimateSeat,
      lastSeat,
    ]);
    expect(completed.winnerSeat).toBe(firstPlaceSeat);
    expect(completed.placements).toHaveLength(playerCount);
    expect(completed.outcome.firstPlaceSeat).toBe(firstPlaceSeat);
    expect(completed.outcome.lastPlaceSeat).toBe(lastSeat);

    const next = startNextRound(completed, () => 0);
    expect(next.currentTurn).toBe(firstPlaceSeat);
    expect(next.trick.leaderSeat).toBe(firstPlaceSeat);
    expect(next.finishedSeats).toEqual([]);
    expect(next.hands).toHaveLength(playerCount);
    expect(next.hands.every((hand) => hand.length === 27)).toBe(true);
    expect(next.openingDraw).toBe(completed.openingDraw);
  });
});
