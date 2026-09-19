import type { GuandanTeam } from "./guandanProtocol";

export const GUANDAN_MATCH_CELEBRATION_MS = 10_000;

export const celebrationFireworks = [
  ["6%", "13%", "#ff334f", "0s"],
  ["15%", "31%", "#ffd43b", "0.22s"],
  ["8%", "55%", "#46d9ff", "0.47s"],
  ["18%", "78%", "#ff74da", "0.72s"],
  ["27%", "10%", "#89ff63", "0.35s"],
  ["31%", "45%", "#ff9238", "0.6s"],
  ["29%", "86%", "#a889ff", "0.9s"],
  ["41%", "21%", "#fff06a", "0.12s"],
  ["43%", "70%", "#4dfff3", "0.52s"],
  ["52%", "8%", "#ff6a91", "0.82s"],
  ["54%", "88%", "#8fff70", "0.28s"],
  ["63%", "24%", "#ffc14d", "0.65s"],
  ["62%", "68%", "#66b9ff", "0.05s"],
  ["72%", "11%", "#ff73ee", "0.42s"],
  ["72%", "48%", "#ff4f4f", "0.77s"],
  ["76%", "84%", "#f6ff68", "0.18s"],
  ["86%", "24%", "#65ffd0", "0.56s"],
  ["91%", "53%", "#ff994d", "0.86s"],
  ["88%", "78%", "#9c7bff", "0.32s"],
  ["21%", "60%", "#ff6685", "1.02s"],
  ["38%", "90%", "#62d7ff", "0.74s"],
  ["58%", "42%", "#ffdc56", "1.08s"],
  ["81%", "64%", "#75ff86", "0.95s"],
  ["96%", "9%", "#ff76c8", "0.14s"],
] as const;

export const winningTeamPlayerNames = (
  players: readonly string[],
  winner: GuandanTeam,
): string[] => {
  const winnerParity = winner === "TeamA" ? 0 : 1;
  return players.filter((_, seat) => seat % 2 === winnerParity);
};
