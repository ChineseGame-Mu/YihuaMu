import { describe, expect, it } from "vitest";
import {
  dealAfterOpeningDraw,
  startOpeningDraw,
  createLobbyState,
} from "../src/core/game-state.js";

describe("opening draw to first turn integration", () => {
  it.each([2, 4, 6] as const)(
    "uses the unique opening-draw winner as the first leader at a %i-player table",
    (playerCount) => {
      const lobby = createLobbyState(playerCount, 0);
      const opening = startOpeningDraw(lobby, () => 0);
      const playing = dealAfterOpeningDraw(opening, () => 0);

      expect(opening.openingDraw.winnerSeat).toBeGreaterThanOrEqual(0);
      expect(opening.openingDraw.winnerSeat).toBeLessThan(playerCount);
      expect(playing.currentTurn).toBe(opening.openingDraw.winnerSeat);
      expect(playing.trick.currentTurn).toBe(opening.openingDraw.winnerSeat);
      expect(playing.trick.leaderSeat).toBe(opening.openingDraw.winnerSeat);
      expect(playing.openingDraw).toEqual(opening.openingDraw);
      expect(playing.hands).toHaveLength(playerCount);
      expect(playing.hands.every((hand) => hand.length === 27)).toBe(true);
    },
  );

  it("keeps opening-draw cards separate from the subsequently dealt deck", () => {
    const opening = startOpeningDraw(createLobbyState(4, 0), () => 0);
    const playing = dealAfterOpeningDraw(opening, () => 0);

    expect(opening.openingDraw.attempts.length).toBeGreaterThan(0);
    expect(
      opening.openingDraw.attempts.every((attempt) =>
        attempt.cards.every(({ card }) => card.kind === "suited"),
      ),
    ).toBe(true);
    expect(playing.hands.flat()).toHaveLength(108);
  });
});
