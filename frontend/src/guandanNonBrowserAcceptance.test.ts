import { readFileSync } from "fs";
import { join } from "path";

// These are source-level guards, not browser or wall-clock acceptance.
describe("Guandan non-browser QA contracts", () => {
  const source = readFileSync(join(__dirname, "GuandanTable.tsx"), "utf8");
  const layout = readFileSync(
    join(__dirname, "guandan-private-layout-20260928.css"),
    "utf8",
  );
  const approvedLayout = readFileSync(
    join(__dirname, "guandan-approved-layout.css"),
    "utf8",
  );

  test.each([4, 6, 8, 10, 12, 14])(
    "nominal ten-second deal for %i players",
    (players) => {
      expect(source).toContain("DEAL_PRESENTATION_DURATION_MS = 10_000");
      expect(source).toContain("window.performance.now() - startedAt");
      expect(source).toContain("elapsed >= DEAL_PRESENTATION_DURATION_MS");
      expect(source).toContain("window.setInterval(");
      expect(source).toContain(
        "Math.floor((elapsed / DEAL_PRESENTATION_DURATION_MS) * totalDealCards)",
      );
      const cards = players * 27;
      let previous = -1;
      for (const elapsed of [0, 2500, 5000, 7500, 9999]) {
        const step = Math.min(cards - 1, Math.floor((elapsed / 10_000) * cards));
        expect(step).toBeGreaterThanOrEqual(previous);
        expect(step).toBeLessThan(cards);
        previous = step;
      }
    },
  );

  test("play and pass dispatch distinct actions", () => {
    expect(source).toContain("onClick={playSelected}");
    expect(source).toContain('send({ type: "play", card_indexes: selected })');
    expect(source).toContain('send({ type: "pass" })');
    expect(layout).toContain("z-index: 10 !important");
    expect(layout).toContain("pointer-events: auto !important");
  });

  test("completed trick has eight-second auto-collection delay", () => {
    expect(source).toContain("TRICK_CLEAR_DELAY_MS = 8000");
    expect(source).toContain('send({ type: "end_round" })');
    expect(source).toContain("TRICK_CLEAR_DELAY_MS,");
  });
  test("review-panel grid placement and selected-card preview clearance", () => {
    expect(approvedLayout).toMatch(
      /section\.guandan-play-actions\s*\{\s*grid-column:\s*2 !important;\s*grid-row:\s*2 \/ 4 !important;/,
    );
    expect(approvedLayout).toMatch(
      /\.guandan-selected-preview\s*\{[\s\S]*?inset:\s*80px 12px 12px !important;/,
    );
    expect(layout).toMatch(
      /section\.guandan-play-actions\s*>\s*button\s*\{[\s\S]*?bottom:\s*12px !important;/,
    );
    expect(layout).toMatch(
      /\.guandan-combo-bottom-controls\s*\{[\s\S]*?bottom:\s*82px !important;/,
    );
    expect(layout).toMatch(
      /section\.guandan-play-actions:has\(\.guandan-combo-bottom-controls\)[\s\S]*?\.guandan-selected-preview\s*\{\s*bottom:\s*196px !important;/,
    );
    expect(layout).toContain("bottom: 170px !important");
  });
});
