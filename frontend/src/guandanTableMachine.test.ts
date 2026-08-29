import { deriveGuandanTablePhase } from "./guandanTableMachine";

const base = {
  playerCount: 4,
  initialDrawWinner: 0,
  handCounts: [27, 27, 27, 27],
  turn: 0,
  finishOrder: [] as number[],
  nextRoundPhase: null,
  matchWinner: null,
};

describe("deriveGuandanTablePhase", () => {
  test("waits until a playable table exists", () => {
    expect(deriveGuandanTablePhase({ ...base, playerCount: 2 })).toBe("waiting");
  });

  test("keeps first-game draw independent from dealing", () => {
    expect(deriveGuandanTablePhase({ ...base, initialDrawWinner: null })).toBe(
      "initial_draw",
    );
  });

  test("enters play only after draw and complete hand counts", () => {
    expect(deriveGuandanTablePhase(base)).toBe("playing");
    expect(deriveGuandanTablePhase({ ...base, handCounts: [] })).toBe("dealing");
  });

  test("models round and next-round gates explicitly", () => {
    expect(
      deriveGuandanTablePhase({
        ...base,
        handCounts: [0, 0, 0, 3],
        finishOrder: [0, 1, 2],
      }),
    ).toBe("round_complete");
    expect(
      deriveGuandanTablePhase({ ...base, nextRoundPhase: "awaiting_shuffle" }),
    ).toBe("awaiting_shuffle");
    expect(
      deriveGuandanTablePhase({ ...base, nextRoundPhase: "awaiting_deal" }),
    ).toBe("awaiting_deal");
  });

  test("match completion has highest priority", () => {
    expect(deriveGuandanTablePhase({ ...base, matchWinner: "A" })).toBe(
      "match_complete",
    );
  });
});
