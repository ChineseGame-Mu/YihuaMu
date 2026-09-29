import type { Team } from "./table.js";

export const COMPETITION_SERIES_MATCHES = 3 as const;

export interface CompetitionSeriesState {
  readonly currentMatch: 1 | 2 | 3;
  readonly completedMatches: 0 | 1 | 2;
  readonly teamAWins: number;
  readonly teamBWins: number;
}

export const supportsThreeMatchSeries = (playerCount: number): boolean =>
  playerCount === 6 ||
  playerCount === 8 ||
  playerCount === 10 ||
  playerCount === 12 ||
  playerCount === 14;

export const initialCompetitionSeries = (
  playerCount: number,
): CompetitionSeriesState | undefined =>
  supportsThreeMatchSeries(playerCount)
    ? {
        currentMatch: 1,
        completedMatches: 0,
        teamAWins: 0,
        teamBWins: 0,
      }
    : undefined;

export const advanceCompetitionSeries = (
  series: CompetitionSeriesState,
  winner: Team,
): CompetitionSeriesState | undefined => {
  if (series.currentMatch === COMPETITION_SERIES_MATCHES) return undefined;
  return {
    currentMatch: (series.currentMatch + 1) as 2 | 3,
    completedMatches: series.currentMatch,
    teamAWins: series.teamAWins + (winner === "A" ? 1 : 0),
    teamBWins: series.teamBWins + (winner === "B" ? 1 : 0),
  };
};
