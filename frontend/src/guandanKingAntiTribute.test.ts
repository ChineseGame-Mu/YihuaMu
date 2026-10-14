import { initialGuandanTableState } from "./guandanCompatibilityAdapter";
import { adaptGuandanServerMessageWithRealTestFixes } from "./guandanRealTestFixes";

const snapshot = (changes: Record<string, unknown> = {}) =>
  ({
    type: "state",
    match_id: 1,
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
    level: "King",
    team_levels: null,
    finish_order: [],
    last_game_winner: 0,
    last_game_winner_team: "TeamA",
    last_promotion_steps: 1,
    pending_tribute: null,
    tribute_resisted: false,
    match_winner: null,
    next_round_phase: null,
    ...changes,
  }) as any;

describe("K-level anti-tribute must be one-time only", () => {
  test("does not reopen after a valid play and clearing the public trick", () => {
    const resisted = adaptGuandanServerMessageWithRealTestFixes(
      initialGuandanTableState,
      snapshot({ tribute_resisted: true }),
    );
    expect(resisted.tributeResisted).toBe(true);

    const card = { Suited: { suit: "Clubs", rank: "Four" } };
    const played = adaptGuandanServerMessageWithRealTestFixes(
      resisted,
      snapshot({
        tribute_resisted: false,
        last_play: [card],
        last_player: 0,
        table_plays: [{ player: 0, cards: [card] }],
        turn: 1,
      }),
    );
    expect(played.tributeResisted).toBe(false);

    const cleared = adaptGuandanServerMessageWithRealTestFixes(
      played,
      snapshot({ tribute_resisted: false, table_clear_id: 1 }),
    );
    expect(cleared.lastPlay).toEqual([]);
    expect(cleared.tablePlays).toEqual([]);
    expect(cleared.tributeResisted).toBe(false);
  });
  test("suppresses anti-tribute during the next-round screen and ignores stale prior-match broadcasts", () => {
    const resisted = adaptGuandanServerMessageWithRealTestFixes(
      initialGuandanTableState,
      snapshot({ match_id: 10, tribute_resisted: true }),
    );
    expect(resisted.tributeResisted).toBe(true);

    const waitingForShuffle = adaptGuandanServerMessageWithRealTestFixes(
      resisted,
      snapshot({
        match_id: 10,
        next_round_phase: "awaiting_shuffle",
        tribute_resisted: true,
      }),
    );
    expect(waitingForShuffle.tributeResisted).toBe(false);

    const newDeal = adaptGuandanServerMessageWithRealTestFixes(
      waitingForShuffle,
      snapshot({ match_id: 11, tribute_resisted: false }),
    );
    expect(newDeal.tributeResisted).toBe(false);

    const lateOldBroadcast = adaptGuandanServerMessageWithRealTestFixes(
      newDeal,
      snapshot({ match_id: 10, tribute_resisted: true }),
    );
    expect(lateOldBroadcast.matchId).toBe(11);
    expect(lateOldBroadcast.tributeResisted).toBe(false);
  });
});
