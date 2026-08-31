import { describe, expect, it } from "vitest";
import { createLobbyState, playGameCards } from "../src/core/game-state.js";
import { classifyHand } from "../src/core/hand.js";
import {
  advanceInteractiveOpeningDraw,
  beginInteractiveOpeningDraw,
  dealAfterInteractiveOpeningDraw,
  finishInteractiveOpeningDraw,
} from "../src/core/interactive-opening-state.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

const constantRandom =
  (value: number): (() => number) =>
  () =>
    value;

describe("first-round opening → hand → table state integration", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "carries the opening winner through a legal first play for %i players",
    (playerCount) => {
      const lobby = createLobbyState(playerCount, 0);
      let opening = beginInteractiveOpeningDraw(lobby, constantRandom(0.5));
      opening = advanceInteractiveOpeningDraw(opening);

      const winnerSeat =
        finishInteractiveOpeningDraw(opening).openingDraw.winnerSeat;
      const playing = dealAfterInteractiveOpeningDraw(
        opening,
        constantRandom(0.5),
      );

      expect(playing.currentTurn).toBe(winnerSeat);
      expect(playing.trick.leaderSeat).toBe(winnerSeat);

      const firstCard = playing.hands[winnerSeat]?.[0]?.card;
      expect(firstCard).toBeDefined();
      if (firstCard === undefined) throw new Error("opening winner has no card");

      expect(classifyHand([firstCard]).kind).toBe("single");

      const beforeCount = playing.hands[winnerSeat]!.length;
      const next = playGameCards(playing, winnerSeat, [firstCard]);

      expect(next.phase).toBe("playing");
      expect(next.hands[winnerSeat]).toHaveLength(beforeCount - 1);
      expect(next.trick.leadingPlay).toMatchObject({
        seat: winnerSeat,
        cards: [firstCard],
      });
      expect(next.currentTurn).toBe((winnerSeat + 1) % playerCount);
    },
  );
});
