import { describe, expect, it } from "vitest";
import {
  completeRound,
  type PlayingState,
} from "../src/core/game-state.js";
import { createTableConfig } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

describe("round completion consistency", () => {
  it("rejects a winner seat that disagrees with the completed finish order", () => {
    const state: PlayingState = {
      phase: "playing",
      config: createTableConfig(4, 0),
      openingDraw: { attempts: [], winnerSeat: 0 },
      hands: [[], [], [], []],
      currentTurn: 0,
      trick: createTrickState(4, 0),
      finishedSeats: [1, 0, 3, 2],
    };

    expect(() => completeRound(state, 0)).toThrow(
      "winner seat must match first place",
    );
    expect(completeRound(state, 1).outcome?.firstPlaceSeat).toBe(1);
  });
});
