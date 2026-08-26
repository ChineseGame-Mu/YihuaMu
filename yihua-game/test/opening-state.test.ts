import { describe, expect, it } from "vitest";
import { createDeck } from "../src/core/deck.js";
import {
  completeRound,
  createLobbyState,
  dealAfterOpeningDraw,
  passGameTurn,
  playGameCards,
  startGame,
  startOpeningDraw,
} from "../src/core/game-state.js";
import { runOpeningDraw } from "../src/core/opening-draw.js";
import {
  CARDS_PER_PLAYER,
  SUPPORTED_PLAYER_COUNTS,
} from "../src/core/table.js";

describe("opening draw", () => {
  it("never uses jokers and produces a valid starter", () => {
    for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
      const result = runOpeningDraw(
        createDeck(playerCount),
        playerCount,
        () => 0.37,
      );
      expect(result.winnerSeat).toBeGreaterThanOrEqual(0);
      expect(result.winnerSeat).toBeLessThan(playerCount);
      expect(
        result.attempts.every((attempt) =>
          attempt.cards.every(({ card }) => card.kind === "suited"),
        ),
      ).toBe(true);
    }
  });

  it("exposes opening draw as an independent state before dealing", () => {
    const lobby = createLobbyState(4, 1);
    const opening = startOpeningDraw(lobby, () => 0.37);

    expect(opening.phase).toBe("opening-draw");
    expect(opening.config).toBe(lobby.config);
    expect(opening.openingDraw.winnerSeat).toBeGreaterThanOrEqual(0);
    expect(opening.openingDraw.winnerSeat).toBeLessThan(4);

    const playing = dealAfterOpeningDraw(opening, () => 0.42);
    expect(playing.phase).toBe("playing");
    expect(playing.openingDraw).toBe(opening.openingDraw);
    expect(playing.currentTurn).toBe(opening.openingDraw.winnerSeat);
    expect(
      playing.hands.every((hand) => hand.length === CARDS_PER_PLAYER),
    ).toBe(true);
  });
});

describe("table state machine", () => {
  it("starts every supported table with 27 cards per player and the draw winner on turn", () => {
    for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
      const lobby = createLobbyState(playerCount, 0);
      const state = startGame(lobby, () => 0.42);

      expect(state.phase).toBe("playing");
      expect(state.hands).toHaveLength(playerCount);
      expect(
        state.hands.every((hand) => hand.length === CARDS_PER_PLAYER),
      ).toBe(true);
      expect(state.currentTurn).toBe(state.openingDraw.winnerSeat);
      expect(state.trick.currentTurn).toBe(state.openingDraw.winnerSeat);
    }
  });

  it("keeps game turn synchronized through an owned play and a complete pass cycle", () => {
    const started = startGame(createLobbyState(4, 0), () => 0.42);
    const leader = started.openingDraw.winnerSeat;
    const leadCard = started.hands[leader]?.[0]?.card;
    if (leadCard === undefined) throw new Error("leader has no dealt card");

    const afterLead = playGameCards(started, leader, [leadCard]);
    if (afterLead.phase !== "playing") throw new Error("round ended too early");

    let state = afterLead;
    for (let offset = 1; offset < 4; offset += 1) {
      const seat = (leader + offset) % 4;
      state = passGameTurn(state, seat);
    }

    expect(state.currentTurn).toBe(leader);
    expect(state.trick.currentTurn).toBe(leader);
    expect(state.trick.leadingPlay).toBeNull();
    expect(state.hands[leader]).toHaveLength(CARDS_PER_PLAYER - 1);
  });

  it("records a valid round winner", () => {
    const playing = startGame(createLobbyState(4, 1), () => 0.61);
    const complete = completeRound(playing, 2);

    expect(complete.phase).toBe("round-complete");
    expect(complete.winnerSeat).toBe(2);
  });

  it("rejects a winner outside the table", () => {
    const playing = startGame(createLobbyState(4, 0), () => 0.51);
    expect(() => completeRound(playing, 4)).toThrow();
  });
});
