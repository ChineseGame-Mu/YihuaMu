import { describe, expect, it } from "vitest";
import { classifyHand } from "../src/core/hand.js";
import { createLobbyState } from "../src/core/game-state.js";
import {
  transitionInteractiveGame,
  type InteractiveGameState,
} from "../src/core/interactive-game-machine.js";
import { interactiveGameSnapshot } from "../src/core/interactive-game-snapshot.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

const deterministicRandom = (): number => 0;

describe("interactive opening to first table lead", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "keeps opening winner as first leader and classifies the first play for %i players",
    (playerCount) => {
      let state: InteractiveGameState = createLobbyState(playerCount, 0);
      state = transitionInteractiveGame(
        state,
        { type: "begin-interactive-opening" },
        deterministicRandom,
      );
      state = transitionInteractiveGame(
        state,
        { type: "complete-opening-and-deal" },
        deterministicRandom,
      );

      expect(state.phase).toBe("playing");
      if (state.phase !== "playing") throw new Error("expected playing state");

      const winnerSeat = state.openingDraw.winnerSeat;
      expect(state.currentTurn).toBe(winnerSeat);
      expect(state.trick.leaderSeat).toBe(winnerSeat);

      const firstCard = state.hands[winnerSeat]?.[0]?.card;
      if (firstCard === undefined) throw new Error("winner hand is empty");
      expect(classifyHand([firstCard]).kind).toBe("single");

      state = transitionInteractiveGame(state, {
        type: "play-cards",
        seat: winnerSeat,
        cards: [firstCard],
      });

      expect(state.phase).toBe("playing");
      const snapshot = interactiveGameSnapshot(state);
      expect(snapshot.openingWinnerSeat).toBe(winnerSeat);
      expect(snapshot.leaderSeat).toBe(winnerSeat);
      expect(snapshot.leadingHand?.kind).toBe("single");
      expect(snapshot.leadingPlay?.seat).toBe(winnerSeat);
      expect(snapshot.handCounts[winnerSeat]).toBeGreaterThan(0);
    },
  );
});
