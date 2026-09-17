import { describe, expect, it } from "vitest";
import type { Card, Suit } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  passGameTurn,
  playGameCards,
  startNextRound,
  type PlayingState,
} from "../src/core/game-state.js";
import { createTableConfig } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const suited = (
  rank: "3" | "4" | "5" | "6" | "7",
  suit: Suit = "clubs",
): Card => ({
  kind: "suited",
  rank,
  suit,
});

const deckCard = (id: string, card: Card): DeckCard => ({
  id,
  copy: 0,
  card,
});

const stateWithOneFinishedTeammate = (): PlayingState => ({
  phase: "playing",
  config: createTableConfig(6, 0),
  openingDraw: { attempts: [], winnerSeat: 0 },
  hands: [
    [deckCard("seat-0", suited("7"))],
    [deckCard("seat-1", suited("3"))],
    [],
    [deckCard("seat-3", suited("4"))],
    [deckCard("seat-4", suited("6"))],
    [deckCard("seat-5", suited("5"))],
  ],
  currentTurn: 0,
  trick: createTrickState(6, 0),
  finishedSeats: [2],
});

describe("six-player finished-seat rotation", () => {
  it("catches to the remaining teammate, then falls back to an active opponent when the team is empty", () => {
    const afterSeat0Finishes = playGameCards(
      stateWithOneFinishedTeammate(),
      0,
      [suited("7")],
    );
    expect(afterSeat0Finishes.phase).toBe("playing");
    if (afterSeat0Finishes.phase !== "playing") {
      throw new Error("round ended too early");
    }
    expect(afterSeat0Finishes.finishedSeats).toEqual([2, 0]);
    expect(afterSeat0Finishes.currentTurn).toBe(1);

    const afterSeat1Pass = passGameTurn(afterSeat0Finishes, 1);
    const afterSeat3Pass = passGameTurn(afterSeat1Pass, 3);
    const afterSeat5Pass = passGameTurn(afterSeat3Pass, 5);

    expect(afterSeat5Pass.trick.leadingPlay).toBeNull();
    expect(afterSeat5Pass.currentTurn).toBe(4);
    expect(afterSeat5Pass.trick.leaderSeat).toBe(4);

    const afterSeat4Finishes = playGameCards(afterSeat5Pass, 4, [suited("6")]);
    expect(afterSeat4Finishes.phase).toBe("playing");
    if (afterSeat4Finishes.phase !== "playing") {
      throw new Error("round ended too early");
    }
    expect(afterSeat4Finishes.finishedSeats).toEqual([2, 0, 4]);
    expect(afterSeat4Finishes.currentTurn).toBe(5);

    const afterSeat5SecondPass = passGameTurn(afterSeat4Finishes, 5);
    const afterSeat1SecondPass = passGameTurn(afterSeat5SecondPass, 1);
    const afterSeat3SecondPass = passGameTurn(afterSeat1SecondPass, 3);

    expect(afterSeat3SecondPass.trick.leadingPlay).toBeNull();
    expect(afterSeat3SecondPass.currentTurn).toBe(5);
    expect(afterSeat3SecondPass.trick.leaderSeat).toBe(5);
    expect(afterSeat3SecondPass.finishedSeats).toEqual([2, 0, 4]);
  });

  it("auto-fills last place and starts the next six-player round from first place", () => {
    const state: PlayingState = {
      phase: "playing",
      config: createTableConfig(6, 0),
      openingDraw: { attempts: [], winnerSeat: 0 },
      hands: [
        [],
        [],
        [],
        [deckCard("seat-3-last", suited("4"))],
        [],
        [deckCard("seat-5-last", suited("3"))],
      ],
      currentTurn: 3,
      trick: createTrickState(6, 3),
      finishedSeats: [2, 0, 4, 1],
    };

    const completed = playGameCards(state, 3, [suited("4")]);
    expect(completed.phase).toBe("round-complete");
    if (completed.phase !== "round-complete") {
      throw new Error("expected round completion");
    }

    expect(completed.finishedSeats).toEqual([2, 0, 4, 1, 3, 5]);
    expect(completed.winnerSeat).toBe(2);
    expect(completed.placements.map(({ seat }) => seat)).toEqual([
      2, 0, 4, 1, 3, 5,
    ]);
    expect(completed.outcome).toEqual({
      winningTeam: "A",
      losingTeam: "B",
      firstPlaceSeat: 2,
      lastPlaceSeat: 5,
    });

    const next = startNextRound(completed, () => 0);
    expect(next.currentTurn).toBe(2);
    expect(next.trick.leaderSeat).toBe(2);
    expect(next.finishedSeats).toEqual([]);
    expect(next.hands).toHaveLength(6);
    expect(next.hands.every((hand) => hand.length === 27)).toBe(true);
    expect(next.openingDraw).toBe(completed.openingDraw);
  });
});
