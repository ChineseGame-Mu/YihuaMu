import { readFileSync } from "fs";
import { join } from "path";

import {
  GUANDAN_MATCH_CELEBRATION_MS,
  formatCelebrationDateTime,
  normalizeWinnerScreenshotEmail,
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

  test("formats the live celebration date and time to the second", () => {
    expect(formatCelebrationDateTime(new Date(2026, 8, 19, 9, 7, 5))).toBe(
      "2026年09月19日 09:07:05",
    );
  });

  test("stores a normalized winner screenshot email address", () => {
    expect(normalizeWinnerScreenshotEmail("  muyihua@gmail.com  ")).toBe(
      "muyihua@gmail.com",
    );
    expect(normalizeWinnerScreenshotEmail(null)).toBe("");
  });

  test("shows the trophy, fireworks, winner names, continue and exit controls", () => {
    const table = readFileSync(join(__dirname, "GuandanTable.tsx"), "utf8");
    const css = readFileSync(
      join(__dirname, "guandan-match-celebration.css"),
      "utf8",
    );
    expect(table).toContain('className="guandan-match-trophy"');
    expect(table).toContain('className="guandan-fireworks"');
    expect(table).toContain('className="guandan-match-celebration-time"');
    expect(table).toContain("庆祝时间：");
    expect(table).toContain("setInterval");
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

  test("provides a test-only online preview for screenshot verification", () => {
    const entry = readFileSync(join(__dirname, "CleanroomEntry.tsx"), "utf8");
    expect(entry).toContain('initial.get("test") === "1"');
    expect(entry).toContain('initial.get("celebrationPreview") === "1"');
    expect(entry).toContain("A级获胜全屏庆祝效果预览");
    expect(entry).toContain("celebrationFireworks.map");
  });

  test("offers one screenshot email field and one 1-3 robot selector", () => {
    const table = readFileSync(join(__dirname, "GuandanTable.tsx"), "utf8");
    expect(table).toContain('id="guandan-winner-screenshot-email"');
    expect(table).toContain('type="email"');
    expect(table).toContain("guandan_winner_screenshot_email");
    expect(table).toContain('id="guandan-bot-count"');
    expect(table).toContain("机器人玩家数量");
    expect(table).toContain("[1, 2, 3].map");
    expect(table).not.toContain("{count} 个机器人");
  });
});
