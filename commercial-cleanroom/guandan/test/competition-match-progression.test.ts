import { describe, expect, it } from "vitest";

import {
  completeRound,
  createLobbyState,
  startGame,
  type PlayingState,
} from "../src/core/game-state.js";
import { RoomManager } from "../src/core/room-manager.js";
import type { Team } from "../src/core/table.js";

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

const finishOrderForTeam = (
  playerCount: number,
  winningTeam: Team,
): number[] => {
  const winnerParity = winningTeam === "A" ? 0 : 1;
  const winners = Array.from(
    { length: playerCount / 2 },
    (_, index) => index * 2 + winnerParity,
  );
  const losers = Array.from(
    { length: playerCount / 2 },
    (_, index) => index * 2 + (1 - winnerParity),
  );
  return [...winners, ...losers];
};

const finishMatch = (
  rooms: RoomManager,
  roomId: string,
  winningTeam: Team,
): void => {
  while (true) {
    const managed = rooms.get(roomId);
    if (managed.game.phase !== "playing") {
      throw new Error("expected a playing game");
    }
    const order = finishOrderForTeam(
      managed.game.config.playerCount,
      winningTeam,
    );
    rooms.set(roomId, {
      ...managed,
      game: completeRound({ ...managed.game, finishedSeats: order }, order[0]!),
    });
    if (managed.game.teamLevels?.[winningTeam] === "A") return;
    rooms.nextRound(roomId, FIXED_RANDOM);
  }
};

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

  it.each([
    [6, 4],
    [8, 5],
    [10, 6],
    [12, 7],
    [14, 8],
  ] as const)(
    "applies the PDF scoring table to a complete %i-player sweep",
    (playerCount, expectedSteps) => {
      const rooms = new RoomManager();
      const roomId = `competition-${playerCount}`;
      const created = rooms.create(roomId, playerCount);
      const playing = startGame(createLobbyState(playerCount, 0), FIXED_RANDOM);
      const teamA = Array.from(
        { length: playerCount / 2 },
        (_, index) => index * 2,
      );
      const teamB = Array.from(
        { length: playerCount / 2 },
        (_, index) => index * 2 + 1,
      );
      const completed = completeRound(
        { ...playing, finishedSeats: [...teamA, ...teamB] },
        teamA[0]!,
      );
      expect(completed.lastPromotionSteps).toBe(expectedSteps);
      rooms.set(roomId, { ...created, game: completed });

      const next = rooms.nextRound(roomId, FIXED_RANDOM);
      expect(next.game.phase).toBe("playing");
      if (next.game.phase !== "playing") return;
      expect(next.game.lastPromotionSteps).toBe(expectedSteps);
      expect(next.game.teamLevels?.A).toBe(
        ["2", "3", "4", "5", "6", "7", "8", "9", "10"][expectedSteps],
      );
      expect(next.game.teamLevels?.B).toBe("2");
    },
  );

  it("does not end the match when the other team wins while Team A is on A", () => {
    const rooms = new RoomManager();
    const created = rooms.create("team-specific-a", 6);
    const playing = startGame(createLobbyState(6, 0), FIXED_RANDOM);
    const completed = completeRound(
      {
        ...playing,
        levelRank: "A",
        teamLevels: { A: "A", B: "2" },
        finishedSeats: [1, 3, 5, 0, 2, 4],
      },
      1,
    );
    rooms.set("team-specific-a", { ...created, game: completed });

    const next = rooms.nextRound("team-specific-a", FIXED_RANDOM);
    expect(next.game.phase).toBe("playing");
    if (next.game.phase !== "playing") return;
    expect(next.game.roundNumber).toBe(2);
    expect(next.game.teamLevels).toEqual({ A: "A", B: "6" });
    expect(next.game.lastPromotionSteps).toBe(4);
  });

  it.each([6, 8, 10, 12, 14] as const)(
    "runs exactly three complete 2-to-A matches for a %i-player table",
    (playerCount) => {
      const rooms = new RoomManager();
      const roomId = "three-match-series-" + playerCount;
      const created = rooms.create(roomId, playerCount);
      rooms.set(roomId, {
        ...created,
        game: startGame(createLobbyState(playerCount, 0), FIXED_RANDOM),
      });

      finishMatch(rooms, roomId, "A");
      expect(rooms.get(roomId).series).toEqual({
        currentMatch: 1,
        completedMatches: 0,
        teamAWins: 0,
        teamBWins: 0,
      });
      const secondMatch = rooms.nextRound(roomId, FIXED_RANDOM);
      expect(secondMatch.series).toEqual({
        currentMatch: 2,
        completedMatches: 1,
        teamAWins: 1,
        teamBWins: 0,
      });
      expect(secondMatch.game.phase).toBe("playing");
      if (secondMatch.game.phase !== "playing") return;
      expect(secondMatch.game.roundNumber).toBe(1);
      expect(secondMatch.game.levelRank).toBe("2");
      expect(secondMatch.game.teamLevels).toEqual({ A: "2", B: "2" });

      finishMatch(rooms, roomId, "B");
      const thirdMatch = rooms.nextRound(roomId, FIXED_RANDOM);
      expect(thirdMatch.series).toEqual({
        currentMatch: 3,
        completedMatches: 2,
        teamAWins: 1,
        teamBWins: 1,
      });
      expect(thirdMatch.game.phase).toBe("playing");
      if (thirdMatch.game.phase !== "playing") return;
      expect(thirdMatch.game.roundNumber).toBe(1);
      expect(thirdMatch.game.levelRank).toBe("2");

      finishMatch(rooms, roomId, "A");
      const newSeries = rooms.nextRound(roomId, FIXED_RANDOM);
      expect(newSeries.series).toEqual({
        currentMatch: 1,
        completedMatches: 0,
        teamAWins: 0,
        teamBWins: 0,
      });
      expect(newSeries.game.phase).toBe("playing");
      if (newSeries.game.phase !== "playing") return;
      expect(newSeries.game.roundNumber).toBe(1);
      expect(newSeries.game.levelRank).toBe("2");
      expect(newSeries.game.teamLevels).toEqual({ A: "2", B: "2" });
    },
  );
});
