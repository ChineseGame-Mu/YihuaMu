import { describe, expect, it } from "vitest";
import {
  createLobbyState,
  dealAfterOpeningDraw,
  startOpeningDraw,
} from "../src/core/game-state.js";

const constantRandom = (value: number) => () => value;

describe("independent opening draw lifecycle", () => {
  it.each([4, 6, 8, 10, 12, 14])(
    "resolves a legal opening leader before dealing for %i players",
    (playerCount) => {
      const lobby = createLobbyState(playerCount, 0);
      const opening = startOpeningDraw(lobby, constantRandom(0.25));

      expect(opening.phase).toBe("opening-draw");
      expect(opening.openingDraw.winnerSeat).toBeGreaterThanOrEqual(0);
      expect(opening.openingDraw.winnerSeat).toBeLessThan(playerCount);
      expect(opening.openingDraw.attempts.length).toBeGreaterThan(0);
      for (const attempt of opening.openingDraw.attempts) {
        expect(attempt.cards).toHaveLength(playerCount);
        expect(attempt.cards.every(({ card }) => card.kind === "suited")).toBe(
          true,
        );
        expect(attempt.seatDraws).toHaveLength(playerCount);
        expect(attempt.seatDraws.map(({ seat }) => seat)).toEqual(
          Array.from({ length: playerCount }, (_, seat) => seat),
        );
        expect(attempt.seatDraws.map(({ card }) => card.id)).toEqual(
          attempt.cards.map((card) => card.id),
        );
      }

      const winningAttempt = opening.openingDraw.attempts.at(-1)!;
      expect(winningAttempt.winnerSeat).toBe(opening.openingDraw.winnerSeat);
      expect(
        winningAttempt.seatDraws[opening.openingDraw.winnerSeat]?.card.card.kind,
      ).toBe("suited");

      const playing = dealAfterOpeningDraw(opening, constantRandom(0.75));
      expect(playing.phase).toBe("playing");
      expect(playing.currentTurn).toBe(opening.openingDraw.winnerSeat);
      expect(playing.trick.leaderSeat).toBe(opening.openingDraw.winnerSeat);
      expect(playing.hands).toHaveLength(playerCount);
      expect(playing.hands.every((hand) => hand.length === 27)).toBe(true);
      expect(playing.openingDraw).toEqual(opening.openingDraw);
    },
  );

  it("keeps opening-draw physical cards separate from the dealt physical deck", () => {
    const lobby = createLobbyState(4, 0);
    const opening = startOpeningDraw(lobby, constantRandom(0.1));
    const playing = dealAfterOpeningDraw(opening, constantRandom(0.9));

    const drawIds = new Set(
      opening.openingDraw.attempts.flatMap((attempt) =>
        attempt.cards.map((card) => card.id),
      ),
    );
    const dealtIds = playing.hands.flatMap((hand) =>
      hand.map((card) => card.id),
    );

    expect(dealtIds).toHaveLength(108);
    expect(new Set(dealtIds).size).toBe(108);
    expect(drawIds.size).toBeGreaterThan(0);
    expect(playing.openingDraw).toEqual(opening.openingDraw);
  });
});
