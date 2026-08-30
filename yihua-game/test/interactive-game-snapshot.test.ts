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
    "projects opening-draw progress and the dealt table for %i players",
    (playerCount) => {
      let state: InteractiveGameState = createLobbyState(playerCount, 0);
      expect(interactiveGameSnapshot(state)).toMatchObject({
        phase: "lobby",
        playerCount,
        openingDraw: null,
        currentTurn: null,
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
      state = transitionInteractiveGame(
        state,
        { type: "deal-after-interactive-opening" },
        fixedRandom,
      );
      expect(interactiveGameSnapshot(state)).toMatchObject({
        phase: "playing",
        playerCount,
        openingDraw: null,
        currentTurn: winnerSeat,
        finishedSeats: [],
        availableActions: ["play-cards", "pass-turn"],
      });
    },
  );
});
