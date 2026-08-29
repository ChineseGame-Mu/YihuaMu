import { shouldClearOwnHand } from "./GuandanStateProvider";

describe("shouldClearOwnHand", () => {
  test("does not clear a live hand for a transient zero hand count", () => {
    expect(shouldClearOwnHand(1, [])).toBe(false);
  });

  test("clears the hand only after the player is explicitly finished", () => {
    expect(shouldClearOwnHand(1, [0, 1])).toBe(true);
  });

  test("never clears observer state without a seat", () => {
    expect(shouldClearOwnHand(null, [0, 1, 2, 3])).toBe(false);
  });
});
