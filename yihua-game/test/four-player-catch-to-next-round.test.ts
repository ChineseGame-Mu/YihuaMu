import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  passGameTurn,
  playGameCards,
  startNextRound,
  type PlayingState,
} from "../src/core/game-state.js";
import { createTableConfig } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const card = (rank: Card extends infer _ ? never : never): never => rank;

const suited = (
  rank: "3" | "4" | "8" | "9",
  suit: "clubs" | "hearts" = "clubs",
): Card => ({
  kind: "suited",
  rank,
  suit,
});

const deckCard = (id: string, value: Card, copy = 0): DeckCard => ({
  id,
  copy,
  card: value,
});

describe("four-player catch through next round", () => {
  it("hands a finished winner's trick to the partner and preserves first place as next leader", () => {
    const seat0Card = suited("8");
    const seat1Card = suited("3");
    const seat2Card = suited("9");
    const seat3Pair = [suited("4"), suited("4", "hearts")] as const;

    let state: PlayingState = {
      phase: "playing",
      config: createTableConfig(4, 0),
      openingDraw: { attempts: [], winnerSeat: 1 },
      hands: [
        [deckCard("s0-8", seat0Card)],
        [deckCard("s1-3", seat1Card)],
        [deckCard("s2-9", seat2Card)],
        [deckCard("s3-4c", seat3Pair[0]), deckCard("s3-4h", seat3Pair[1])],
      ],
      currentTurn: 1,
      trick: createTrickState(4, 1),
      finishedSeats: [],
    };

    const afterSeat1 = playGameCards(state, 1, [seat1Card]);
    expect(afterSeat1.phase).toBe("playing");
    if (afterSeat1.phase !== "playing") throw new Error("expected playing");
    state = afterSeat1;
    expect(state.finishedSeats).toEqual([1]);
    expect(state.currentTurn).toBe(2);

    state = passGameTurn(state, 2);
    expect(state.currentTurn).toBe(0);
    state = passGameTurn(state, 0);
    expect(state.currentTurn).toBe(3);
    expect(state.trick.leadingPlay).toBeNull();

    const afterSeat3 = playGameCards(state, 3, seat3Pair);
    expect(afterSeat3.phase).toBe("playing");
    if (afterSeat3.phase !== "playing") throw new Error("expected playing");
    state = afterSeat3;
    expect(state.finishedSeats).toEqual([1, 3]);
    expect(state.currentTurn).toBe(0);

    state = passGameTurn(state, 0);
    expect(state.currentTurn).toBe(2);
    state = passGameTurn(state, 2);
    expect(state.currentTurn).toBe(0);
    expect(state.trick.leadingPlay).toBeNull();

    const completed = playGameCards(state, 0, [seat0Card]);
    expect(completed.phase).toBe("round-complete");
    if (completed.phase !== "round-complete") {
      throw new Error("expected round completion");
    }

    expect(completed.finishedSeats).toEqual([1, 3, 0, 2]);
    expect(completed.winnerSeat).toBe(1);
    expect(completed.outcome?.firstPlaceSeat).toBe(1);
    expect(completed.outcome?.lastPlaceSeat).toBe(2);

    const next = startNextRound(completed, () => 0);
    expect(next.currentTurn).toBe(1);
    expect(next.trick.leaderSeat).toBe(1);
    expect(next.finishedSeats).toEqual([]);
    expect(next.hands.every((hand) => hand.length === 27)).toBe(true);
    expect(next.openingDraw).toBe(completed.openingDraw);
  });
});
