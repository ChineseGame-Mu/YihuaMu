import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  passGameTurn,
  playGameCards,
  type PlayingState,
} from "../src/core/game-state.js";
import {
  createTableConfig,
  type SupportedPlayerCount,
} from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const leadCard: Card = { kind: "suited", rank: "7", suit: "clubs" };
const spareCard: Card = { kind: "suited", rank: "3", suit: "clubs" };

const deckCard = (id: string, card: Card): DeckCard => ({ id, copy: 0, card });

const largeCounts: SupportedPlayerCount[] = [8, 10, 12, 14];

const passAllOpponents = (state: PlayingState): PlayingState => {
  let next = state;
  const opponentSeats = Array.from(
    { length: state.config.playerCount / 2 },
    (_, index) => index * 2 + 1,
  );
  for (const seat of opponentSeats) next = passGameTurn(next, seat);
  return next;
};

describe.each(largeCounts)("%i-player catch rotation", (playerCount) => {
  it("gives the next lead to the nearest active teammate", () => {
    const hands = Array.from({ length: playerCount }, (_, seat) =>
      seat === 0
        ? [deckCard("leader", leadCard)]
        : [deckCard(`seat-${seat}`, spareCard)],
    );
    const state: PlayingState = {
      phase: "playing",
      config: createTableConfig(playerCount, 0),
      openingDraw: { attempts: [], winnerSeat: 0 },
      hands,
      currentTurn: 0,
      trick: createTrickState(playerCount, 0),
      finishedSeats: [],
    };

    const afterFinish = playGameCards(state, 0, [leadCard]);
    if (afterFinish.phase !== "playing") throw new Error("round ended too early");
    const afterPasses = passAllOpponents(afterFinish);

    expect(afterPasses.trick.leadingPlay).toBeNull();
    expect(afterPasses.currentTurn).toBe(2);
    expect(afterPasses.trick.leaderSeat).toBe(2);
  });

  it("falls back to the nearest active opponent when every teammate is finished", () => {
    const finishedTeammates = Array.from(
      { length: playerCount / 2 - 1 },
      (_, index) => (index + 1) * 2,
    );
    const hands = Array.from({ length: playerCount }, (_, seat) => {
      if (finishedTeammates.includes(seat)) return [];
      return seat === 0
        ? [deckCard("leader", leadCard)]
        : [deckCard(`seat-${seat}`, spareCard)];
    });
    const state: PlayingState = {
      phase: "playing",
      config: createTableConfig(playerCount, 0),
      openingDraw: { attempts: [], winnerSeat: 0 },
      hands,
      currentTurn: 0,
      trick: createTrickState(playerCount, 0),
      finishedSeats: finishedTeammates,
    };

    const afterFinish = playGameCards(state, 0, [leadCard]);
    if (afterFinish.phase !== "playing") throw new Error("round ended too early");
    const afterPasses = passAllOpponents(afterFinish);

    expect(afterPasses.trick.leadingPlay).toBeNull();
    expect(afterPasses.currentTurn).toBe(1);
    expect(afterPasses.trick.leaderSeat).toBe(1);
  });
});
