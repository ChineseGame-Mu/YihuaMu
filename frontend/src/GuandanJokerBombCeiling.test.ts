import { findSuggestedIndexes, handCanBeat } from "./GuandanNoBeatHint";
import type { GuandanCard } from "./guandanProtocol";

const joker = (value: "Small" | "Big"): GuandanCard => ({ Joker: value });

describe("Guandan joker bomb ceiling", () => {
  test("does not let one joker bomb beat another joker bomb", () => {
    const hand = [joker("Small"), joker("Small"), joker("Big"), joker("Big")];
    const current = [
      joker("Small"),
      joker("Small"),
      joker("Big"),
      joker("Big"),
    ];

    expect(handCanBeat(hand, current, "Two")).toBe(false);
    expect(findSuggestedIndexes(hand, current, "Two")).toEqual([]);
  });
});
