import { initialGuandanTableState } from "./guandanCompatibilityAdapter";
import { adaptGuandanServerMessageWithRealTestFixes } from "./guandanRealTestFixes";

function stateMessage(
  matchId: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    type: "state",
    match_id: matchId,
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
    ...overrides,
  } as any;
}

describe("K-level anti-tribute delayed and repeated snapshots", () => {
  test("delayed previous-match resistance cannot reopen notice", () => {
    const resisted = adaptGuandanServerMessageWithRealTestFixes(
      initialGuandanTableState,
      stateMessage(1, { tribute_resisted: true }),
    );
    const newMatch = adaptGuandanServerMessageWithRealTestFixes(
      resisted,
      stateMessage(2),
    );
    const stale = adaptGuandanServerMessageWithRealTestFixes(
      newMatch,
      stateMessage(1, { tribute_resisted: true }),
    );
    expect(newMatch.tributeResisted).toBe(false);
    expect(stale).toBe(newMatch);
  });

  test("shuffle-phase resistance and duplicate post-play snapshots do not reopen notice", () => {
    const resisted = adaptGuandanServerMessageWithRealTestFixes(
      initialGuandanTableState,
      stateMessage(1, { tribute_resisted: true }),
    );
    const shuffleState = stateMessage(1, {
      next_round_phase: "awaiting_shuffle",
      tribute_resisted: true,
    });
    const shuffling = adaptGuandanServerMessageWithRealTestFixes(
      resisted,
      shuffleState,
    );
    expect(shuffling.tributeResisted).toBe(false);

    const card = { Suited: { suit: "Clubs", rank: "Four" } };
    const postPlayState = stateMessage(1, {
      last_play: [card],
      last_player: 0,
      table_plays: [{ player: 0, cards: [card] }],
    });
    const played = adaptGuandanServerMessageWithRealTestFixes(
      resisted,
      postPlayState,
    );
    const repeated = adaptGuandanServerMessageWithRealTestFixes(
      played,
      postPlayState,
    );
    expect(played.tributeResisted).toBe(false);
    expect(repeated.tributeResisted).toBe(false);
  });
});
