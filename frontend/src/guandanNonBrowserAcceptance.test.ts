import { readFileSync } from "fs";
import { join } from "path";

/**
 * Source-level acceptance guards only. They are deliberately NOT browser,
 * wall-clock, or four-human multiplayer acceptance tests.
 */
describe("Guandan isolated QA non-browser acceptance contracts", () => {
  const table = readFileSync(join(__dirname, "GuandanTable.tsx"), "utf8");
  const layout = readFileSync(
    join(__dirname, "guandan-private-layout-20260928.css"),
    "utf8",
  );

  test.each([4, 6, 8, 10, 12, 14])(
    "uses nominal ten-second card-by-card deal pacing for %i players",
    (playerCount) => {
      const durationMatch = table.match(
        /const DEAL_PRESENTATION_DURATION_MS = ([\d_]+);/,
      );
      expect(durationMatch).not.toBeNull();
      const duration = Number(durationMatch![1]!.replace(/_/g, ""));
      expect(duration).toBe(10_000);
      expect(table).toContain(
        "Math.ceil(DEAL_PRESENTATION_DURATION_MS / totalDealCards)",
      );
      expect(table).toContain("setDealStep((current) =>");
      expect(table).toContain("current === null ? null : Math.min(current + 1, totalDealCards)");
      const totalCards = playerCount * 27;
      const nominalMilliseconds = Math.ceil(duration / totalCards) * totalCards;
      expect(nominalMilliseconds).toBeGreaterThanOrEqual(10_000);
      // setTimeout rounding may extend the nominal animation by <= 300 ms.
      // This does not establish wall-clock timing under browser event-loop load.
      expect(nominalMilliseconds).toBeLessThanOrEqual(10_300);
    },
  );

  test("play and pass controls are wired to distinct game actions", () => {
    expect(table).toContain('className="guandan-play-action"');
    expect(table).toContain("onClick={playSelected}");
    expect(table).toContain('send({ type: "play", card_indexes: selected })');
    expect(table).toContain('className="guandan-pass-action"');
    expect(table).toContain('onClick={() => send({ type: "pass" })}');
    expect(table).toContain("disabled={!gameStarted || selected.length === 0}");
    expect(table).toContain("disabled={!gameStarted || state.lastPlayer === null}");
    expect(layout).toContain("z-index: 10 !important");
    expect(layout).toContain("pointer-events: auto !important");
  });

  test("completed trick is held for eight seconds before automatic collection", () => {
    expect(table).toContain("const TRICK_CLEAR_DELAY_MS = 8000;");
    expect(table).toContain(
      '() => send({ type: "end_round" }),\n      TRICK_CLEAR_DELAY_MS,',
    );
    expect(table).toContain("state.trickComplete");
    expect(table).toContain("state.lastPlayer");
    expect(table).toContain("state.seat !== state.lastPlayer");
  });
});
