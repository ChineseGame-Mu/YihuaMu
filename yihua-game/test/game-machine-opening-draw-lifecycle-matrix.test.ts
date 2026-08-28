import { describe, expect, it } from "vitest";
import { transitionGame } from "../src/core/game-machine.js";
import { completeRound, createLobbyState } from "../src/core/game-state.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const PLAYER_COUNTS: readonly SupportedPlayerCount[] = [4, 6, 8, 10, 12, 14];
const fixedRandom = () => 0;

describe("opening draw lifecycle state-machine matrix", () => {
  it.each(PLAYER_COUNTS)(
    "moves lobby -> opening draw -> playing with one authoritative first leader for %i players",
    (playerCount) => {
      const lobby = createLobbyState(playerCount, 0);
      expect(() =>
        transitionGame(lobby, { type: "deal-after-opening-draw" }, fixedRandom),
      ).toThrow(/cannot deal-after-opening-draw while game is lobby/);

      const opening = transitionGame(
        lobby,
        { type: "begin-opening-draw" },
        fixedRandom,
      );
      expect(opening.phase).toBe("opening-draw");
      if (opening.phase !== "opening-draw") {
        throw new Error("opening-draw phase expected");
      }
      expect(opening.openingDraw.winnerSeat).toBeGreaterThanOrEqual(0);
      expect(opening.openingDraw.winnerSeat).toBeLessThan(playerCount);
      expect(() =>
        transitionGame(opening, { type: "begin-opening-draw" }, fixedRandom),
      ).toThrow(/cannot begin-opening-draw while game is opening-draw/);

      const playing = transitionGame(
        opening,
        { type: "deal-after-opening-draw" },
        fixedRandom,
      );
      expect(playing.phase).toBe("playing");
      if (playing.phase !== "playing") {
        throw new Error("playing phase expected");
      }

      const winner = opening.openingDraw.winnerSeat;
      expect(playing.currentTurn).toBe(winner);
      expect(playing.trick.currentTurn).toBe(winner);
      expect(playing.trick.leaderSeat).toBe(winner);
      expect(playing.trick.leadingPlay).toBeNull();
      expect(playing.hands).toHaveLength(playerCount);
      expect(playing.hands.every((hand) => hand.length === 27)).toBe(true);
      expect(playing.openingDraw).toEqual(opening.openingDraw);
      expect(() =>
        transitionGame(playing, { type: "next-round" }, fixedRandom),
      ).toThrow(/cannot next-round while game is playing/);

      const finishOrder = Array.from({ length: playerCount }, (_, seat) => seat);
      const completed = completeRound(
        { ...playing, finishedSeats: finishOrder },
        finishOrder[0] ?? 0,
      );
      expect(completed.phase).toBe("round-complete");
      expect(() =>
        transitionGame(completed, { type: "begin-opening-draw" }, fixedRandom),
      ).toThrow(/cannot begin-opening-draw while game is round-complete/);

      const next = transitionGame(
        completed,
        { type: "next-round" },
        fixedRandom,
      );
      expect(next.phase).toBe("playing");
      if (next.phase !== "playing") throw new Error("playing phase expected");
      expect(next.currentTurn).toBe(completed.winnerSeat);
      expect(next.trick.leaderSeat).toBe(completed.winnerSeat);
      expect(next.openingDraw).toEqual(opening.openingDraw);
      expect(next.hands.every((hand) => hand.length === 27)).toBe(true);
    },
  );
});
