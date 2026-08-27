import { describe, expect, it } from "vitest";
import {
  createLobbyState,
  dealAfterOpeningDraw,
  startOpeningDraw,
} from "../src/core/game-state.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const supportedOpeningTables: readonly SupportedPlayerCount[] = [
  4, 6, 8, 10, 12, 14,
];

describe("opening draw to first turn integration", () => {
  for (const playerCount of supportedOpeningTables) {
    it(`uses the unique opening-draw winner as the first leader at a ${playerCount}-player table`, () => {
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
    });
  }

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
