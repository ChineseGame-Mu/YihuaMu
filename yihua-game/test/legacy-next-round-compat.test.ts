import { describe, expect, it } from "vitest";

import {
  gameStateToLegacy,
  toCleanroomCommand,
} from "../src/core/frontend-compat.js";
import type { ServerMessage } from "../src/core/protocol.js";

const game = (
  phase: "playing" | "round-complete",
): Extract<ServerMessage, { readonly type: "game_state" }> => ({
  type: "game_state",
  roomId: "room-a",
  revision: 12,
  phase,
  currentTurn: 0,
  handCounts: [0, 0, 0, 4],
  openingDraw: [],
  openingDrawWinner: 0,
  leadingPlay: null,
  passedSeats: [],
  finishedSeats: [0, 2, 1],
  completedTricks: 20,
});

const room = (
  losingTeamReady: boolean,
): Extract<ServerMessage, { readonly type: "room_state" }> => ({
  type: "room_state",
  roomId: "room-a",
  playerCount: 4,
  robotCount: 0,
  participants: [
    { id: "a", name: "A", seat: 0, kind: "human", connected: true },
    {
      id: "b",
      name: "B",
      seat: 1,
      kind: "human",
      connected: true,
      readyForNextRound: losingTeamReady,
    },
    { id: "c", name: "C", seat: 2, kind: "human", connected: true },
    { id: "d", name: "D", seat: 3, kind: "human", connected: true },
  ],
});

describe("legacy next-round compatibility bridge", () => {
  it("exposes the first finisher as the previous winner and waits for a losing-team shuffle", () => {
    const legacy = gameStateToLegacy(room(false), game("round-complete"));
    expect(legacy.type).toBe("state");
    if (legacy.type !== "state") return;
    expect(legacy.last_game_winner).toBe(0);
    expect(legacy.next_round_phase).toBe("awaiting_shuffle");
  });

  it("advances the old UI to deal after a losing-team player marks shuffle ready", () => {
    const legacy = gameStateToLegacy(room(true), game("round-complete"));
    expect(legacy.type).toBe("state");
    if (legacy.type !== "state") return;
    expect(legacy.last_game_winner).toBe(0);
    expect(legacy.next_round_phase).toBe("awaiting_deal");
  });

  it("translates the old shuffle button into clean-room next-round readiness", () => {
    expect(
      toCleanroomCommand(
        {
          type: "shuffle_next_round",
          from_position: null,
          to_position: null,
        },
        { roomId: "room-a", playerId: "legacy:A", seat: 0, privateCardIds: [] },
      ),
    ).toEqual({ type: "set_next_round_ready", ready: true });
  });

  it("keeps the winner's old deal button mapped to the clean-room next-round transition", () => {
    expect(
      toCleanroomCommand(
        { type: "deal_next_round" },
        { roomId: "room-a", playerId: "legacy:A", seat: 0, privateCardIds: [] },
      ),
    ).toEqual({ type: "next_round" });
  });
});
