import { describe, expect, it } from "vitest";

import {
  assertLegacyNextRoundRole,
  legacyNextRoundRobotState,
} from "../src/core/legacy-guandan-gateway.js";
import type { ManagedRoom } from "../src/core/room-manager.js";
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

describe("legacy robot next-round continuation", () => {
  const managed = (winnerKind: "human" | "robot"): ManagedRoom => ({
    revision: 1,
    tribute: undefined,
    room: {
      roomId: "room-a",
      config: {
        playerCount: 4,
        botCount: winnerKind === "robot" ? 2 : 1,
        cardsPerPlayer: 27,
      },
      participants: [
        {
          id: "winner",
          name: "赢家",
          seat: 0,
          kind: winnerKind,
          connected: true,
        },
        {
          id: "loser",
          name: "机器人输家",
          seat: 1,
          kind: "robot",
          connected: true,
        },
      ],
    },
    game: {
      phase: "round-complete",
      config: { playerCount: 4, robotCount: 2 },
      openingDraw: { attempts: [], winnerSeat: 0 },
      hands: [[], [], [], []],
      currentTurn: 0,
      finishedSeats: [0, 2, 1, 3],
      placements: [0, 2, 1, 3],
    } as unknown as ManagedRoom["game"],
  });

  it("lets a losing robot satisfy the shuffle step for a human winner", () => {
    expect(legacyNextRoundRobotState(managed("human"))).toEqual({
      shuffleReady: true,
      winnerIsRobot: false,
    });
  });

  it("lets a robot winner auto-deal after a losing robot auto-shuffles", () => {
    expect(legacyNextRoundRobotState(managed("robot"))).toEqual({
      shuffleReady: true,
      winnerIsRobot: true,
    });
  });
});
