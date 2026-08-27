import { describe, expect, it } from "vitest";
import { buildRoundPlacements } from "../src/core/round-result.js";

describe("round placements", () => {
  it("preserves finish order as explicit places and teams", () => {
    expect(buildRoundPlacements(4, [1, 3, 0, 2])).toEqual([
      { place: 1, seat: 1, team: "B" },
      { place: 2, seat: 3, team: "B" },
      { place: 3, seat: 0, team: "A" },
      { place: 4, seat: 2, team: "A" },
    ]);
  });

  it("rejects duplicate, missing, or out-of-range seats", () => {
    expect(() => buildRoundPlacements(4, [0, 1, 1, 3])).toThrow();
    expect(() => buildRoundPlacements(4, [0, 1, 2])).toThrow();
    expect(() => buildRoundPlacements(4, [0, 1, 2, 4])).toThrow();
  });
});
