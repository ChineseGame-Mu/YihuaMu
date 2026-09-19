import { describe, expect, it } from "vitest";

import {
  completeRound,
  createLobbyState,
  startGame,
  type PlayingState,
} from "../src/core/game-state.js";
import { RoomManager } from "../src/core/room-manager.js";

const FIXED_RANDOM = (): number => 0.5;
const DOUBLE_DOWN_A = [0, 2, 1, 3] as const;

const completeAsTeamADoubleDown = (game: PlayingState) =>
  completeRound(
    {
      ...game,
      finishedSeats: DOUBLE_DOWN_A,
    },
    0,
  );

describe("integrated competitive match progression", () => {
  it("advances a four-player team from 2 through A, then restarts after an A win", () => {
    const rooms = new RoomManager();
    const created = rooms.create("competition-progression", 4);
    let game = startGame(createLobbyState(4, 0), FIXED_RANDOM);

    rooms.set("competition-progression", {
      ...created,
      game: completeAsTeamADoubleDown(game),
    });

    const expectedLevels = ["5", "8", "J", "A"] as const;
    for (const expectedLevel of expectedLevels) {
      const next = rooms.nextRound("competition-progression", FIXED_RANDOM);
      expect(next.game.phase).toBe("playing");
      if (next.game.phase !== "playing") return;
      expect(next.game.teamLevels).toEqual({ A: expectedLevel, B: "2" });
      expect(next.game.levelRank).toBe(expectedLevel);
      expect(next.game.matchWinner).toBeNull();

      game = next.game;
      rooms.set("competition-progression", {
        ...next,
        game: completeAsTeamADoubleDown(game),
      });
    }

    const restarted = rooms.nextRound("competition-progression", FIXED_RANDOM);
    expect(restarted.game.phase).toBe("playing");
    if (restarted.game.phase !== "playing") return;
    expect(restarted.game.roundNumber).toBe(1);
    expect(restarted.game.levelRank).toBe("2");
    expect(restarted.game.teamLevels).toEqual({ A: "2", B: "2" });
    expect(restarted.game.matchWinner).toBeNull();
    expect(restarted.game.currentTurn).toBe(
      restarted.game.openingDraw.winnerSeat,
    );
  });
});
