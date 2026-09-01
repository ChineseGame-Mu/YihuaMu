import { describe, expect, it } from "vitest";
import {
  legacyTributePlan,
  prepareLegacyTribute,
} from "../src/core/legacy-tribute.js";

describe("legacy tribute mapping", () => {
  it("makes fourth place tribute first place after a normal result", () => {
    prepareLegacyTribute("single-tribute", [0, 1, 2, 3]);

    expect(legacyTributePlan("single-tribute")).toEqual({
      Single: { giver: 3, receiver: 0 },
    });
  });

  it("makes both losing players tribute both winners after a double-down", () => {
    prepareLegacyTribute("double-tribute", [0, 2, 1, 3]);

    expect(legacyTributePlan("double-tribute")).toEqual({
      Double: {
        givers: [3, 1],
        receivers: [0, 2],
      },
    });
  });

  it("clears tribute when the previous result is not a four-player finish", () => {
    prepareLegacyTribute("clear-tribute", [0, 1, 2, 3]);
    prepareLegacyTribute("clear-tribute", [0, 1, 2]);

    expect(legacyTributePlan("clear-tribute")).toBeNull();
  });
});
