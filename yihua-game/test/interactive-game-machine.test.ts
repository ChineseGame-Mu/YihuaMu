import { describe, expect, it } from "vitest";
import {
  availableInteractiveGameActions,
  transitionInteractiveGame,
  type InteractiveGameState,
} from "../src/core/interactive-game-machine.js";
import { createLobbyState } from "../src/core/game-state.js";
import { classifyHand } from "../src/core/hand.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

const fixedRandom = (): number => 0.999999;

describe("interactive game machine", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "drives a %i-player first round through interactive draw and deal",
    (playerCount) => {
      let state: InteractiveGameState = createLobbyState(playerCount, 0);

      expect(availableInteractiveGameActions(state)).toContain(
        "begin-interactive-opening",
      );
      state = transitionInteractiveGame(
        state,
        { type: "begin-interactive-opening" },
        fixedRandom,
      );
      expect(state.phase).toBe("interactive-opening-draw");

      let guard = 0;
      while (
        state.phase === "interactive-opening-draw" &&
        state.draw.phase !== "complete"
      ) {
        expect(availableInteractiveGameActions(state)).toEqual([
          "draw-opening-attempt",
          "complete-interactive-opening",
          "complete-opening-and-deal",
        ]);
        state = transitionInteractiveGame(
          state,
          { type: "draw-opening-attempt" },
          fixedRandom,
        );
        guard += 1;
        expect(guard).toBeLessThan(100);
      }

      expect(state.phase).toBe("interactive-opening-draw");
      if (state.phase !== "interactive-opening-draw") return;
      expect(state.draw.phase).toBe("complete");
      expect(availableInteractiveGameActions(state)).toEqual([
        "deal-after-interactive-opening",
        "complete-opening-and-deal",
      ]);

      const winnerSeat = state.draw.session.winnerSeat;
      state = transitionInteractiveGame(
        state,
        { type: "deal-after-interactive-opening" },
        fixedRandom,
      );
      expect(state.phase).toBe("playing");
      if (state.phase !== "playing") return;
      expect(state.currentTurn).toBe(winnerSeat);
      expect(state.hands).toHaveLength(playerCount);
      expect(state.hands.every((hand) => hand.length === 27)).toBe(true);
    },
  );

  it.each(SUPPORTED_PLAYER_COUNTS)(
    "can complete a %i-player opening draw through the machine action",
    (playerCount) => {
      let state: InteractiveGameState = createLobbyState(playerCount, 0);
      state = transitionInteractiveGame(
        state,
        { type: "begin-interactive-opening" },
        () => 0,
      );
      state = transitionInteractiveGame(
        state,
        { type: "complete-interactive-opening" },
        () => 0,
      );

      expect(state.phase).toBe("interactive-opening-draw");
      if (state.phase !== "interactive-opening-draw") return;
      expect(state.draw.phase).toBe("complete");
      expect(state.draw.session.winnerSeat).not.toBeNull();
      expect(availableInteractiveGameActions(state)).toEqual([
        "deal-after-interactive-opening",
        "complete-opening-and-deal",
      ]);
    },
  );

  it.each(SUPPORTED_PLAYER_COUNTS)(
    "atomically completes opening draw and prepares a %i-player table",
    (playerCount) => {
      let state: InteractiveGameState = createLobbyState(playerCount, 0);
      state = transitionInteractiveGame(
        state,
        { type: "begin-interactive-opening" },
        fixedRandom,
      );
      state = transitionInteractiveGame(
        state,
        { type: "complete-opening-and-deal" },
        fixedRandom,
      );

      expect(state.phase).toBe("playing");
      if (state.phase !== "playing") return;
      expect(state.currentTurn).toBe(state.openingDraw.winnerSeat);
      expect(state.trick.leaderSeat).toBe(state.openingDraw.winnerSeat);
      expect(state.hands).toHaveLength(playerCount);
      expect(state.hands.every((hand) => hand.length === 27)).toBe(true);

      const firstCard = state.hands[state.currentTurn]?.[0]?.card;
      expect(firstCard).toBeDefined();
      if (firstCard === undefined) return;
      expect(classifyHand([firstCard]).kind).toBe("single");
    },
  );

  it("rejects dealing before the interactive opening draw has a winner", () => {
    let state: InteractiveGameState = createLobbyState(4, 0);
    state = transitionInteractiveGame(
      state,
      { type: "begin-interactive-opening" },
      fixedRandom,
    );

    expect(() =>
      transitionInteractiveGame(
        state,
        { type: "deal-after-interactive-opening" },
        fixedRandom,
      ),
    ).toThrow("opening draw has not produced a unique winner");
  });

  it("keeps legacy table actions unavailable during an interactive draw", () => {
    let state: InteractiveGameState = createLobbyState(4, 0);
    state = transitionInteractiveGame(
      state,
      { type: "begin-interactive-opening" },
      fixedRandom,
    );

    expect(() =>
      transitionInteractiveGame(state, { type: "pass-turn", seat: 0 }),
    ).toThrow("cannot pass-turn while game is interactive-opening-draw");
  });
});
