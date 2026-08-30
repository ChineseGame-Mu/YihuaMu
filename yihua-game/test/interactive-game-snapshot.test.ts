import { describe, expect, it } from "vitest";
import { createLobbyState } from "../src/core/game-state.js";
import {
  transitionInteractiveGame,
  type InteractiveGameState,
} from "../src/core/interactive-game-machine.js";
import { interactiveGameSnapshot } from "../src/core/interactive-game-snapshot.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

const fixedRandom = (): number => 0;

describe("interactive game snapshot", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "projects opening-draw progress and the live table for %i players",
    (playerCount) => {
      let state: InteractiveGameState = createLobbyState(playerCount, 0);
      expect(interactiveGameSnapshot(state)).toMatchObject({
        phase: "lobby",
        playerCount,
        openingDraw: null,
        currentTurn: null,
        handCounts: [],
        leadingPlay: null,
        leadingHand: null,
        passedSeats: [],
        completedTricks: 0,
      });

      state = transitionInteractiveGame(
        state,
        { type: "begin-interactive-opening" },
        fixedRandom,
      );
      expect(interactiveGameSnapshot(state)).toMatchObject({
        phase: "interactive-opening-draw",
        playerCount,
        currentTurn: null,
        openingDraw: {
          phase: "drawing",
          attemptsCompleted: 0,
          cardsDrawn: 0,
          winnerSeat: null,
        },
        handCounts: [],
        leadingPlay: null,
        leadingHand: null,
      });

      state = transitionInteractiveGame(
        state,
        { type: "complete-interactive-opening" },
        fixedRandom,
      );
      const completed = interactiveGameSnapshot(state);
      expect(completed.phase).toBe("interactive-opening-draw");
      expect(completed.openingDraw?.phase).toBe("complete");
      expect(completed.openingDraw?.winnerSeat).not.toBeNull();
      expect(completed.availableActions).toEqual([
        "deal-after-interactive-opening",
      ]);

      const winnerSeat = completed.openingDraw?.winnerSeat;
      expect(winnerSeat).not.toBeNull();
      expect(winnerSeat).not.toBeUndefined();
      if (winnerSeat == null) return;

      state = transitionInteractiveGame(
        state,
        { type: "deal-after-interactive-opening" },
        fixedRandom,
      );
      const dealt = interactiveGameSnapshot(state);
      expect(dealt).toMatchObject({
        phase: "playing",
        playerCount,
        openingDraw: null,
        currentTurn: winnerSeat,
        handCounts: Array(playerCount).fill(27),
        leadingPlay: null,
        leadingHand: null,
        passedSeats: [],
        completedTricks: 0,
        finishedSeats: [],
        availableActions: ["play-cards", "pass-turn"],
      });

      expect(state.phase).toBe("playing");
      if (state.phase !== "playing") return;
      const firstCard = state.hands[winnerSeat]?.[0]?.card;
      expect(firstCard).toBeDefined();
      if (firstCard === undefined) return;

      state = transitionInteractiveGame(state, {
        type: "play-cards",
        seat: winnerSeat,
        cards: [firstCard],
      });
      const afterPlay = interactiveGameSnapshot(state);
      expect(afterPlay.handCounts[winnerSeat]).toBe(26);
      expect(afterPlay.leadingPlay).toEqual({
        seat: winnerSeat,
        cards: [firstCard],
      });
      expect(afterPlay.leadingHand).toMatchObject({
        kind: "single",
        size: 1,
      });
      expect(afterPlay.currentTurn).not.toBe(winnerSeat);
      expect(afterPlay.finishedSeats).toEqual([]);
    },
  );
});
