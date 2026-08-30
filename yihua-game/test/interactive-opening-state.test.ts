import { describe, expect, it } from "vitest";
import { createLobbyState } from "../src/core/game-state.js";
import {
  advanceInteractiveOpeningDraw,
  beginInteractiveOpeningDraw,
  completeInteractiveOpeningDraw,
  dealAfterInteractiveOpeningDraw,
  finishInteractiveOpeningDraw,
  interactiveOpeningSnapshot,
} from "../src/core/interactive-opening-state.js";

const constantRandom =
  (value: number): (() => number) =>
  () =>
    value;

describe("interactive opening draw integration", () => {
  it.each([4, 6, 8, 10, 12, 14] as const)(
    "exposes a table-ready opening snapshot for %i players",
    (playerCount) => {
      const lobby = createLobbyState(playerCount, 0);
      const initial = beginInteractiveOpeningDraw(lobby, constantRandom(0.5));
      const before = interactiveOpeningSnapshot(initial);

      expect(before.phase).toBe("interactive-opening-draw");
      expect(before.playerCount).toBe(playerCount);
      expect(before.readyToDeal).toBe(false);
      expect(before.progress.phase).toBe("drawing");
      expect(before.progress.attemptsCompleted).toBe(0);
      expect(before.progress.winnerSeat).toBeNull();
      expect(before.prompt).toMatchObject({
        phase: "drawing",
        canDraw: true,
        attemptNumber: 1,
        isRedraw: false,
        cardsRequired: playerCount,
      });
      expect(before.prompt.seatsToDraw).toEqual(
        Array.from({ length: playerCount }, (_, seat) => seat),
      );

      const completed = completeInteractiveOpeningDraw(initial);
      const after = interactiveOpeningSnapshot(completed);

      expect(after.readyToDeal).toBe(true);
      expect(after.progress.phase).toBe("complete");
      expect(after.progress.attemptsCompleted).toBeGreaterThan(0);
      expect(after.progress.winnerSeat).not.toBeNull();
      expect(after.prompt).toMatchObject({
        phase: "complete",
        canDraw: false,
        attemptNumber: null,
        cardsRequired: 0,
      });
      expect(after.prompt.seatsToDraw).toEqual([]);
    },
  );

  it.each([4, 6, 8, 10, 12, 14] as const)(
    "advances one visible opening attempt at a time for %i players",
    (playerCount) => {
      const lobby = createLobbyState(playerCount, 0);
      let state = beginInteractiveOpeningDraw(lobby, constantRandom(0.5));

      expect(state.draw.session.attempts).toHaveLength(0);
      expect(() => finishInteractiveOpeningDraw(state)).toThrow(
        "opening draw has not produced a unique winner",
      );

      state = advanceInteractiveOpeningDraw(state);

      expect(state.draw.session.attempts).toHaveLength(1);
      expect(state.draw.session.attempts[0]!.seatDraws).toHaveLength(
        playerCount,
      );
      expect(state.draw.phase).toBe("complete");

      const opening = finishInteractiveOpeningDraw(state);
      expect(opening.phase).toBe("opening-draw");
      expect(opening.openingDraw.attempts).toHaveLength(1);
    },
  );

  it("carries the independently drawn winner into the first playing turn", () => {
    const lobby = createLobbyState(4, 0);
    let state = beginInteractiveOpeningDraw(lobby, constantRandom(0.5));
    state = advanceInteractiveOpeningDraw(state);

    const winnerSeat =
      finishInteractiveOpeningDraw(state).openingDraw.winnerSeat;
    const playing = dealAfterInteractiveOpeningDraw(state, constantRandom(0.5));

    expect(playing.phase).toBe("playing");
    expect(playing.currentTurn).toBe(winnerSeat);
    expect(playing.trick.leaderSeat).toBe(winnerSeat);
    expect(playing.hands).toHaveLength(4);
    expect(playing.hands.every((hand) => hand.length === 27)).toBe(true);
  });
});
