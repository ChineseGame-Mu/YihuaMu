import { describe, expect, it } from "vitest";

import { assertLegacyNextRoundRole } from "../src/core/legacy-guandan-gateway.js";
import type { ServerMessage } from "../src/core/protocol.js";

const completedGame = (): Extract<
  ServerMessage,
  { readonly type: "game_state" }
> => ({
  type: "game_state",
  roomId: "room-a",
  revision: 20,
  phase: "round-complete",
  currentTurn: 0,
  handCounts: [0, 0, 0, 4],
  openingDraw: [],
  openingDrawWinner: 0,
  leadingPlay: null,
  passedSeats: [],
  finishedSeats: [0, 2, 1],
  completedTricks: 20,
});

describe("legacy next-round role guard", () => {
  it("allows a losing-team player to shuffle", () => {
    expect(() =>
      assertLegacyNextRoundRole(
        { type: "shuffle_next_round", from_position: null, to_position: null },
        1,
        completedGame(),
      ),
    ).not.toThrow();
  });

  it("rejects the winning team trying to shuffle", () => {
    expect(() =>
      assertLegacyNextRoundRole(
        { type: "shuffle_next_round", from_position: null, to_position: null },
        2,
        completedGame(),
      ),
    ).toThrow("only the losing team may shuffle");
  });

  it("allows only the previous winner to deal", () => {
    expect(() =>
      assertLegacyNextRoundRole(
        { type: "deal_next_round" },
        0,
        completedGame(),
      ),
    ).not.toThrow();
    expect(() =>
      assertLegacyNextRoundRole(
        { type: "deal_next_round" },
        1,
        completedGame(),
      ),
    ).toThrow("only the previous winner may deal");
  });
});
