import fs from "fs";
import path from "path";

const src = (...parts: string[]): string =>
  fs.readFileSync(path.join(__dirname, ...parts), "utf8");

describe("Guandan human-pretest regressions", () => {
  test("public plays include player names", () => {
    const table = src("GuandanTable.tsx");
    expect(table).toContain('className="guandan-trick-play"');
    expect(table).toContain(
      'state.players[play.player] ?? `玩家${play.player + 1}`',
    );
  });

  test("public-play names stay visible below cards", () => {
    const css = src("guandan-real-test-20260916.css");
    expect(css).toContain(
      ".guandan-table .guandan-table-stage .guandan-trick-play > strong",
    );
    expect(css).toContain("order: 2 !important");
    expect(css).toContain("visibility: visible !important");
    expect(css).toContain("opacity: 1 !important");
    expect(css).toContain("color: #ffffff !important");
    expect(css).toContain("overflow: visible !important");
  });

  test("duplicate fixed last-round HUD is not mounted", () => {
    const entry = src("CleanroomEntry.tsx");
    expect(entry).not.toContain("GuandanLastRoundScoreboard");
  });

  test("winner scoring persists between rounds", () => {
    const hud = src("GuandanRoundResultHud.tsx");
    expect(hud).toContain("scoreStorageKey");
    expect(hud).toContain("scoreSignatureKey");
    expect(hud).toContain("lastCompleteFinishOrder");
    expect(hud).toContain("window.localStorage.setItem");
    expect(hud).toContain("current.a + model.promotionSteps");
    expect(hud).toContain("current.b + model.promotionSteps");
  });
});
