import { shouldShowCompletedRoundResult } from "./guandanRoundResultVisibility";
import { readFileSync } from "fs";
import { join } from "path";

const completedRound = {
  finishOrder: [0, 2, 1, 3],
  hand: [],
  handCounts: [0, 0, 0, 0],
  matchWinner: null,
  nextRoundPhase: null,
  playerCount: 4,
  players: ["甲", "乙", "丙", "丁"],
};

describe("completed Guandan round result visibility", () => {
  test("shows one result immediately after the round finishes", () => {
    expect(shouldShowCompletedRoundResult(completedRound)).toBe(true);
  });

  test.each(["awaiting_shuffle", "awaiting_deal"])(
    "hides the old result during next-round phase %s",
    (nextRoundPhase) => {
      expect(
        shouldShowCompletedRoundResult({
          ...completedRound,
          nextRoundPhase,
        }),
      ).toBe(false);
    },
  );

  test("hides the old result as soon as fresh cards are dealt", () => {
    expect(
      shouldShowCompletedRoundResult({
        ...completedRound,
        hand: [{ rank: "Two", suit: "Clubs" }],
        handCounts: [27, 27, 27, 27],
      }),
    ).toBe(false);
  });

  test("does not duplicate the full-match celebration", () => {
    expect(
      shouldShowCompletedRoundResult({
        ...completedRound,
        matchWinner: "TeamA",
      }),
    ).toBe(false);
  });

  test("the public table no longer renders duplicate ranking and previous-winner panels", () => {
    const table = readFileSync(join(__dirname, "GuandanTable.tsx"), "utf8");
    const resultHud = readFileSync(
      join(__dirname, "GuandanRoundResultHud.tsx"),
      "utf8",
    );

    expect(table).not.toContain('aria-label="输赢顺序"');
    expect(table).not.toContain('aria-label="四位玩家输赢顺序"');
    expect(table).not.toContain('aria-label="本轮输赢排序"');
    expect(table).not.toContain('aria-label="上一局结果"');
    expect(table).toContain(
      "threeMatchSeriesActive && showCompletedRoundResult",
    );
    expect(resultHud).toContain("showCompletedRoundResult &&");
  });
});
