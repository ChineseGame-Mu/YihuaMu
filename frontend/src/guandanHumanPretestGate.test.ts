import fs from "fs";
import path from "path";

const src = (...parts: string[]): string =>
  fs.readFileSync(path.join(__dirname, ...parts), "utf8");

describe("Guandan mandatory human-pretest UI regressions", () => {
  test("public table renders the actual player name for every table play", () => {
    const table = src("GuandanTable.tsx");
    expect(table).toContain('className="guandan-trick-play"');
    expect(table).toContain(
      'state.players[play.player] ?? `玩家${play.player + 1}`',
    );
  });

  test("public-play name is forced visible below the cards", () => {
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
});
