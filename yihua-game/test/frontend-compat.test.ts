import { describe, expect, it } from "vitest";

import {
  gameStateToLegacy,
  legacyCard,
  privateHandToLegacy,
  roomStateToLegacyWaiting,
  toCleanroomCommand,
} from "../src/core/frontend-compat.js";

const roomState = {
  type: "room_state" as const,
  roomId: "room-1",
  revision: 4,
  playerCount: 6,
  robotCount: 0,
  participants: [
    {
      id: "p2",
      name: "玩家2",
      seat: 1,
      kind: "human" as const,
      connected: true,
      readyForNextRound: false,
    },
    {
      id: "p1",
      name: "玩家1",
      seat: 0,
      kind: "human" as const,
      connected: true,
      readyForNextRound: false,
    },
  ],
};

describe("legacy frontend compatibility adapter", () => {
  it("converts clean-room cards to the existing frontend card shape", () => {
    expect(legacyCard({ kind: "suited", suit: "hearts", rank: "A" })).toEqual({
      Suited: { suit: "Hearts", rank: "Ace" },
    });
    expect(legacyCard({ kind: "joker", size: "big" })).toEqual({
      Joker: "Big",
    });
  });

  it("maps existing frontend commands onto clean-room commands", () => {
    const state = {
      roomId: "room-1",
      playerId: "p1",
      seat: 0,
      privateCardIds: ["c0", "c1", "c2"],
    };

    expect(
      toCleanroomCommand({ type: "start", player_count: 6 }, state),
    ).toEqual({
      type: "start_game",
    });
    expect(
      toCleanroomCommand({ type: "play", card_indexes: [2, 0] }, state),
    ).toEqual({
      type: "play_cards",
      cardIds: ["c2", "c0"],
    });
    expect(toCleanroomCommand({ type: "pass" }, state)).toEqual({
      type: "pass_turn",
    });
    expect(toCleanroomCommand({ type: "end_round" }, state)).toEqual({
      type: "next_round",
    });
    expect(
      toCleanroomCommand({ type: "set_participation", active: true }, state),
    ).toEqual({ type: "set_next_round_ready", ready: true });
  });

  it("rejects unsupported legacy-only commands instead of proxying them", () => {
    const state = {
      roomId: "room-1",
      playerId: "p1",
      seat: 0,
      privateCardIds: ["c0"],
    };
    const unsupported = [
      { type: "reorder_players", order: [0, 1] as const },
      { type: "set_bots", count: 1 as const },
      { type: "shuffle_next_round", from_position: 0, to_position: 1 },
      { type: "deal_next_round" },
      { type: "tribute_card", card_index: 0 },
      { type: "return_tribute", card_index: 0 },
    ] as const;

    for (const command of unsupported) {
      expect(() => toCleanroomCommand(command, state)).toThrow(
        `legacy command ${command.type} is not implemented by the clean-room engine`,
      );
    }
  });

  it("rejects an old frontend card index that cannot be resolved", () => {
    expect(() =>
      toCleanroomCommand(
        { type: "play", card_indexes: [3] },
        {
          roomId: "room-1",
          playerId: "p1",
          seat: 0,
          privateCardIds: ["c0"],
        },
      ),
    ).toThrow("legacy play card index is out of range");
  });

  it("preserves player seat ordering in the existing waiting view", () => {
    expect(roomStateToLegacyWaiting(roomState)).toEqual({
      type: "waiting",
      players: ["玩家1", "玩家2"],
      observers: [],
      online_players: [true, true],
      minimum_players: 4,
      maximum_players: 14,
    });
  });

  it("converts the private hand and public game snapshot", () => {
    expect(
      privateHandToLegacy({
        type: "private_hand",
        roomId: "room-1",
        revision: 5,
        seat: 0,
        cards: [
          {
            id: "c0",
            card: { kind: "suited", suit: "spades", rank: "K" },
          },
        ],
      }),
    ).toEqual({
      type: "hand",
      cards: [{ Suited: { suit: "Spades", rank: "King" } }],
    });

    const legacy = gameStateToLegacy(roomState, {
      type: "game_state",
      roomId: "room-1",
      revision: 5,
      phase: "playing",
      currentTurn: 1,
      handCounts: [26, 27],
      openingDraw: [
        { kind: "suited", suit: "clubs", rank: "2" },
        { kind: "suited", suit: "diamonds", rank: "3" },
      ],
      openingDrawWinner: 1,
      leadingPlay: {
        seat: 0,
        cards: [{ kind: "joker", size: "small" }],
      },
      passedSeats: [1],
      finishedSeats: [],
      completedTricks: 0,
    });

    expect(legacy).toMatchObject({
      type: "state",
      players: ["玩家1", "玩家2"],
      turn: 1,
      hand_counts: [26, 27],
      last_play: [{ Joker: "Small" }],
      last_player: 0,
      passes: 1,
      initial_draw_winner: 1,
      finish_order: [],
    });
  });
});
