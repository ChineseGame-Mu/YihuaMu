import {
  guandanTurnOpportunityKey,
  normalizeGuandanTurnPromptEnabled,
  shouldPlayGuandanTurnPrompt,
  type GuandanTurnPromptEligibility,
} from "./guandanTurnPrompt";

const eligible: GuandanTurnPromptEligibility = {
  enabled: true,
  connected: true,
  gameStarted: true,
  dealing: false,
  seat: 2,
  turn: 2,
  handCount: 12,
  tributePending: false,
  trickComplete: false,
  nextRoundPending: false,
  matchComplete: false,
  playerFinished: false,
};

describe("Guandan current-player sound prompt", () => {
  test("defaults on and honors the browser-local off setting", () => {
    expect(normalizeGuandanTurnPromptEnabled(null)).toBe(true);
    expect(normalizeGuandanTurnPromptEnabled("on")).toBe(true);
    expect(normalizeGuandanTurnPromptEnabled("off")).toBe(false);
  });

  test("sounds only for the connected human whose turn is actionable", () => {
    expect(shouldPlayGuandanTurnPrompt(eligible)).toBe(true);
    expect(shouldPlayGuandanTurnPrompt({ ...eligible, turn: 3 })).toBe(false);
    expect(shouldPlayGuandanTurnPrompt({ ...eligible, seat: null })).toBe(
      false,
    );
    expect(
      shouldPlayGuandanTurnPrompt({ ...eligible, tributePending: true }),
    ).toBe(false);
    expect(
      shouldPlayGuandanTurnPrompt({ ...eligible, trickComplete: true }),
    ).toBe(false);
    expect(
      shouldPlayGuandanTurnPrompt({ ...eligible, nextRoundPending: true }),
    ).toBe(false);
    expect(
      shouldPlayGuandanTurnPrompt({ ...eligible, playerFinished: true }),
    ).toBe(false);
  });

  test("gives each changed play opportunity a stable deduplication key", () => {
    const first = guandanTurnOpportunityKey(4, 0, 2, [
      { player: 1, cards: [{}, {}] },
    ]);
    expect(first).toBe(
      guandanTurnOpportunityKey(4, 0, 2, [{ player: 1, cards: [{}, {}] }]),
    );
    expect(first).not.toBe(
      guandanTurnOpportunityKey(4, 1, 2, [{ player: 1, cards: [{}, {}] }]),
    );
    expect(first).not.toBe(guandanTurnOpportunityKey(5, 0, 2, []));
  });
});
