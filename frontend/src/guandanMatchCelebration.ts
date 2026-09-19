import type { GuandanTeam } from "./guandanProtocol";

export const GUANDAN_MATCH_CELEBRATION_MS = 10_000;

export const winningTeamPlayerNames = (
  players: readonly string[],
  winner: GuandanTeam,
): string[] => {
  const winnerParity = winner === "TeamA" ? 0 : 1;
  return players.filter((_, seat) => seat % 2 === winnerParity);
};
