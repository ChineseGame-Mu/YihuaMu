import { initialGuandanTableState } from "./guandanCompatibilityAdapter";
import { adaptGuandanServerMessageWithRealTestFixes } from "./guandanRealTestFixes";
import type { GuandanCard } from "./guandanProtocol";

const suited = (
  rank: "Four" | "King",
  suit: "Clubs" | "Hearts" = "Clubs",
): GuandanCard => ({
  Suited: { rank, suit },
});

const stateMessage = (overrides: Record<string, unknown> = {}) =>
  ({
    type: "state",
    players: ["A", "B", "C", "D"],
    observers: [],
    online_players: [true, true, true, true],
    turn: 0,
    hand_counts: [27, 27, 27, 27],
    last_play: [],
    last_player: null,
    table_plays: [],
    passes: 0,
    trick_complete: false,
    last_trick_winner: null,
    initial_draw: [],
    initial_draw_winner: null,
    level: "Two",
    team_levels: null,
    finish_order: [],
    last_game_winner: null,
    last_game_winner_team: null,
    last_promotion_steps: null,
    pending_tribute: null,
    tribute_resisted: false,
    match_winner: null,
    next_round_phase: null,
    hook_to_bottom: false,
    ...overrides,
  }) as any;

describe("2026-09-16 mandatory real-test regressions", () => {
  test("sorts every public play from small to large", () => {
    const next = adaptGuandanServerMessageWithRealTestFixes(
      initialGuandanTableState,
      stateMessage({
        last_play: [suited("King"), suited("Four")],
        last_player: 2,
        table_plays: [
          { player: 2, cards: [suited("King", "Hearts"), suited("Four")] },
        ],
      }),
    );

    expect(next.tablePlays[0]?.cards).toEqual([
      suited("Four"),
      suited("King", "Hearts"),
    ]);
  });

  test("authoritative empty snapshot clears the public table", () => {
    const current = {
      ...initialGuandanTableState,
      tablePlays: [{ player: 0, cards: [suited("Four")] }],
      lastPlay: [suited("Four")],
      lastPlayer: 0,
      trickComplete: true,
    };

    const next = adaptGuandanServerMessageWithRealTestFixes(
      current,
      stateMessage(),
    );

    expect(next.tablePlays).toEqual([]);
    expect(next.lastPlay).toEqual([]);
  });

  test("a newer clear id rejects delayed cards from the previous trick", () => {
    const current = {
      ...initialGuandanTableState,
      tablePlays: [{ player: 0, cards: [suited("Four")] }],
      lastPlay: [suited("Four")],
      lastPlayer: 0,
      trickComplete: true,
      tableClearId: 7,
    };

    const next = adaptGuandanServerMessageWithRealTestFixes(
      current,
      stateMessage({
        table_clear_id: 8,
        table_plays: [{ player: 0, cards: [suited("Four")] }],
        last_play: [suited("Four")],
      }),
    );

    expect(next.tablePlays).toEqual([]);
    expect(next.tableClearId).toBe(8);
  });

  test("clears a finished player's stale private hand", () => {
    const current = {
      ...initialGuandanTableState,
      seat: 1,
      hand: [suited("Four")],
    };

    const next = adaptGuandanServerMessageWithRealTestFixes(
      current,
      stateMessage({
        finish_order: [0, 1],
        hand_counts: [0, 0, 27, 27],
      }),
    );

    expect(next.hand).toEqual([]);
  });

  test("clears every private hand while awaiting the next-round shuffle", () => {
    const current = {
      ...initialGuandanTableState,
      seat: 3,
      hand: [suited("King")],
    };

    const next = adaptGuandanServerMessageWithRealTestFixes(
      current,
      stateMessage({ next_round_phase: "awaiting_shuffle" }),
    );

    expect(next.hand).toEqual([]);
  });

  test("restores the winner's authoritative private hand for the second round", () => {
    const previousRound = {
      ...initialGuandanTableState,
      seat: 0,
      finishOrder: [0, 1, 2, 3],
      hand: [],
    };
    const secondRoundHand = [suited("Four"), suited("King")];

    const next = adaptGuandanServerMessageWithRealTestFixes(previousRound, {
      type: "hand",
      cards: secondRoundHand,
    });

    expect(next.hand).toEqual(secondRoundHand);
  });
});
