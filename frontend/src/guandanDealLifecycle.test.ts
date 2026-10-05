import { shouldAnimateGuandanDeal } from "./guandanDealLifecycle";

const base = {
  previousHandSize: 0,
  currentHandSize: 27,
  previousNextRoundPhase: null,
  nextRoundPhase: null,
  playerCount: 4,
  alreadyAnimated: false,
} as const;

describe("Guandan deal animation lifecycle", () => {
  test("animates the initial full deal", () => {
    expect(shouldAnimateGuandanDeal(base)).toBe(true);
  });

  test("animates only the real awaiting-deal to playing transition", () => {
    expect(
      shouldAnimateGuandanDeal({
        ...base,
        previousHandSize: 27,
        previousNextRoundPhase: "awaiting_deal",
      }),
    ).toBe(true);
  });

  test("does not deal again after return tribute restores one card", () => {
    expect(
      shouldAnimateGuandanDeal({
        ...base,
        previousHandSize: 26,
        currentHandSize: 27,
      }),
    ).toBe(false);
  });

  test("does not deal again when tribute removes one card", () => {
    expect(
      shouldAnimateGuandanDeal({
        ...base,
        previousHandSize: 27,
        currentHandSize: 26,
      }),
    ).toBe(false);
  });

  test("does not replay an already animated deal", () => {
    expect(shouldAnimateGuandanDeal({ ...base, alreadyAnimated: true })).toBe(
      false,
    );
  });
});
