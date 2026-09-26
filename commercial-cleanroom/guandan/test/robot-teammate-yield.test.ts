import { describe, expect, it } from "vitest";
import {
  robotMustYieldToTeammate,
  type ManagedRoom,
} from "../src/core/room-manager.js";

const managed = (
  robotSeat: number,
  leadingSeat: number | undefined,
  playerCount = 4,
): ManagedRoom =>
  ({
    room: {
      participants: [{ seat: robotSeat, kind: "robot" }],
    },
    game: {
      phase: "playing",
      config: { playerCount },
      trick: {
        leadingPlay:
          leadingSeat === undefined
            ? null
            : { seat: leadingSeat, cards: [], hand: {} },
      },
    },
  }) as unknown as ManagedRoom;

describe("robot teammate protection", () => {
  it("yields when the current leading player is its teammate", () => {
    expect(robotMustYieldToTeammate(managed(0, 2), 0)).toBe(true);
    expect(robotMustYieldToTeammate(managed(2, 0), 2)).toBe(true);
    expect(robotMustYieldToTeammate(managed(1, 3), 1)).toBe(true);
    expect(robotMustYieldToTeammate(managed(3, 1), 3)).toBe(true);
  });

  it.each([4, 6, 8, 10, 12, 14])(
    "protects a teammate's lead with %i players",
    (playerCount) => {
      expect(robotMustYieldToTeammate(managed(0, 2, playerCount), 0)).toBe(
        true,
      );
      expect(robotMustYieldToTeammate(managed(3, 1, playerCount), 3)).toBe(
        true,
      );
    },
  );

  it("does not suppress play against an opponent or on an open table", () => {
    expect(robotMustYieldToTeammate(managed(0, 1), 0)).toBe(false);
    expect(robotMustYieldToTeammate(managed(0, 3), 0)).toBe(false);
    expect(robotMustYieldToTeammate(managed(0, undefined), 0)).toBe(false);
  });
});
