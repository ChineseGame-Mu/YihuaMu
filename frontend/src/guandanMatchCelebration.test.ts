import { readFileSync } from "fs";
import { join } from "path";

import {
  GUANDAN_MATCH_CELEBRATION_MS,
  winningTeamPlayerNames,
} from "./guandanMatchCelebration";

describe("Guandan A-level match celebration", () => {
  const players = ["甲", "乙", "丙", "丁", "戊", "己"];

  test("lists every member of the winning team in seat-team order", () => {
    expect(winningTeamPlayerNames(players, "TeamA")).toEqual([
      "甲",
      "丙",
      "戊",
    ]);
    expect(winningTeamPlayerNames(players, "TeamB")).toEqual([
      "乙",
      "丁",
      "己",
    ]);
  });

  test("keeps fireworks visible for exactly ten seconds", () => {
    expect(GUANDAN_MATCH_CELEBRATION_MS).toBe(10_000);
  });

  test("shows the trophy, fireworks, winner names, continue and exit controls", () => {
    const table = readFileSync(join(__dirname, "GuandanTable.tsx"), "utf8");
    const css = readFileSync(
      join(__dirname, "guandan-match-celebration.css"),
      "utf8",
    );
    expect(table).toContain('className="guandan-match-trophy"');
    expect(table).toContain('className="guandan-fireworks"');
    expect(table).toContain("celebrationFireworks.map");
    expect(table).toContain('" guandan-match-celebrating"');
    expect(table).toContain("获胜队员：");
    expect(table).toMatch(/>\s*继续\s*</);
    expect(table).toMatch(/>\s*退出\s*</);
    expect(css).toContain("@keyframes guandan-firework-burst");
    expect(css).toContain(
      ".guandan-match-complete-panel.guandan-match-celebrating",
    );
    expect(css).toContain(
      ".guandan-match-complete-panel:not(.guandan-match-celebrating)",
    );
  });
});
