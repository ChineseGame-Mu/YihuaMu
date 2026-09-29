import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { createDeck } from "../src/core/deck.js";
import { classifyHand } from "../src/core/hand.js";
import { runOpeningDraw } from "../src/core/opening-draw.js";
import {
  createTrickState,
  passTurn,
  playCards,
} from "../src/core/trick-state.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});

describe("next-step supported table matrix", () => {
  for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
    it(`keeps opening draw and trick reset valid for ${playerCount} players`, () => {
      const opening = runOpeningDraw(
        createDeck(playerCount),
        playerCount,
        () => 0.25,
      );
      expect(opening.winnerSeat).toBeGreaterThanOrEqual(0);
      expect(opening.winnerSeat).toBeLessThan(playerCount);
      expect(
        opening.attempts.every((attempt) =>
          attempt.cards.every(({ card }) => card.kind === "suited"),
        ),
      ).toBe(true);

      let state = createTrickState(playerCount, opening.winnerSeat);
      state = playCards(state, opening.winnerSeat, [suited("8", "clubs")]);

      for (let offset = 1; offset < playerCount; offset += 1) {
        const seat = (opening.winnerSeat + offset) % playerCount;
        state = passTurn(state, seat);
      }

      expect(state.leadingPlay).toBeNull();
      expect(state.currentTurn).toBe(opening.winnerSeat);
      expect(state.leaderSeat).toBe(opening.winnerSeat);
      expect(state.completedTricks).toBe(1);
      expect(state.passedSeats).toEqual([]);
    });
  }

  it("classifies every supported non-bomb combination family", () => {
    expect(classifyHand([suited("A", "clubs")]).kind).toBe("single");
    expect(
      classifyHand([suited("9", "clubs"), suited("9", "hearts")]).kind,
    ).toBe("pair");
    expect(
      classifyHand([
        suited("7", "clubs"),
        suited("7", "diamonds"),
        suited("7", "hearts"),
      ]).kind,
    ).toBe("triple");
    expect(
      classifyHand([
        suited("6", "clubs"),
        suited("6", "diamonds"),
        suited("6", "hearts"),
        suited("K", "clubs"),
        suited("K", "hearts"),
      ]).kind,
    ).toBe("full-house");
    expect(
      classifyHand([
        suited("5", "clubs"),
        suited("6", "diamonds"),
        suited("7", "hearts"),
        suited("8", "spades"),
        suited("9", "clubs"),
      ]).kind,
    ).toBe("straight");
    expect(
      classifyHand([
        suited("5", "hearts"),
        suited("6", "hearts"),
        suited("7", "hearts"),
        suited("8", "hearts"),
        suited("9", "hearts"),
      ]).kind,
    ).toBe("straight-flush");
    expect(
      classifyHand([
        suited("5", "clubs"),
        suited("5", "hearts"),
        suited("6", "clubs"),
        suited("6", "hearts"),
        suited("7", "clubs"),
        suited("7", "hearts"),
      ]).kind,
    ).toBe("consecutive-pairs");
    expect(
      classifyHand([
        suited("5", "clubs"),
        suited("5", "diamonds"),
        suited("5", "hearts"),
        suited("6", "clubs"),
        suited("6", "diamonds"),
        suited("6", "hearts"),
      ]).kind,
    ).toBe("consecutive-triples");
  });
});
