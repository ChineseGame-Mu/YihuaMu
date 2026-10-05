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
      card_count_alert_threshold: 6,
      next_round_joiners: [],
      next_round_leavers: [],
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
      levelRank: "4",
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
      level: "Four",
      finish_order: [],
    });
  });

  it.each([6, 8, 10, 12, 14] as const)(
    "shows level 3 immediately after Team B earns one point with %i players",
    (playerCount) => {
      const otherSeats = Array.from(
        { length: playerCount },
        (_, seat) => seat,
      ).filter((seat) => seat !== 1);
      const legacy = gameStateToLegacy(
        { ...roomState, playerCount },
        {
          type: "game_state",
          roomId: "room-1",
          revision: 6,
          phase: "round-complete",
          roundNumber: 1,
          levelRank: "2",
          teamLevels: { A: "2", B: "2" },
          lastPromotionSteps: 1,
          currentTurn: 1,
          handCounts: Array.from({ length: playerCount }, () => 0),
          openingDraw: [],
          openingDrawWinner: null,
          leadingPlay: null,
          passedSeats: [],
          finishedSeats: [1, ...otherSeats],
          completedTricks: 27,
        },
      );

      expect(legacy.type).toBe("state");
      if (legacy.type !== "state") throw new Error("expected legacy state");
      expect(legacy.level).toBe("Three");
      expect(legacy.last_game_winner_team).toBe("TeamB");
      expect(legacy.last_promotion_steps).toBe(1);
    },
  );

  it("treats promotion from K to A as another playable round, not a match win", () => {
    const fourPlayerRoom = {
      ...roomState,
      playerCount: 4,
      participants: [
        { id: "p1", name: "Yihua", seat: 0, kind: "human" as const, connected: true, readyForNextRound: false },
        { id: "r1", name: "机器人1", seat: 1, kind: "robot" as const, connected: true, readyForNextRound: false },
        { id: "r2", name: "机器人2", seat: 2, kind: "robot" as const, connected: true, readyForNextRound: false },
        { id: "r3", name: "机器人3", seat: 3, kind: "robot" as const, connected: true, readyForNextRound: false },
      ],
    };
    const legacy = gameStateToLegacy(fourPlayerRoom, {
      type: "game_state",
      roomId: "room-1",
      revision: 7,
      phase: "round-complete",
      roundNumber: 8,
      levelRank: "K",
      teamLevels: { A: "K", B: "2" },
      lastPromotionSteps: 1,
      currentTurn: 0,
      handCounts: [0, 0, 0, 0],
      openingDraw: [],
      openingDrawWinner: null,
      leadingPlay: null,
      passedSeats: [],
      finishedSeats: [0, 1, 2, 3],
      completedTricks: 27,
    });

    expect(legacy.type).toBe("state");
    if (legacy.type !== "state") throw new Error("expected legacy state");
    expect(legacy.level).toBe("Ace");
    expect(legacy.match_winner).toBeNull();
    expect(legacy.next_round_phase).toBe("awaiting_deal");
  });

  it("ends only after the winning team was already playing A", () => {
    const fourPlayerRoom = {
      ...roomState,
      playerCount: 4,
      participants: [
        { id: "r3", name: "机器人3", seat: 0, kind: "robot" as const, connected: true, readyForNextRound: false },
        { id: "p2", name: "玩家2", seat: 1, kind: "human" as const, connected: true, readyForNextRound: true },
        { id: "r2", name: "机器人2", seat: 2, kind: "robot" as const, connected: true, readyForNextRound: false },
        { id: "r1", name: "机器人1", seat: 3, kind: "robot" as const, connected: true, readyForNextRound: false },
      ],
    };
    const legacy = gameStateToLegacy(fourPlayerRoom, {
      type: "game_state",
      roomId: "room-1",
      revision: 8,
      phase: "round-complete",
      roundNumber: 9,
      levelRank: "A",
      teamLevels: { A: "A", B: "2" },
      lastPromotionSteps: 2,
      currentTurn: 0,
      handCounts: [0, 0, 0, 0],
      openingDraw: [],
      openingDrawWinner: null,
      leadingPlay: null,
      passedSeats: [],
      finishedSeats: [0, 1, 2, 3],
      completedTricks: 27,
    });

    expect(legacy.type).toBe("state");
    if (legacy.type !== "state") throw new Error("expected legacy state");
    expect(legacy.match_winner).toBe("TeamA");
    expect(legacy.next_round_phase).toBeNull();
  });

});

// Keep this compatibility suite on the formatted descendant so full CI runs there.
