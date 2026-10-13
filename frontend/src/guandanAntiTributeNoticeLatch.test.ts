import { initialGuandanTableState } from "./guandanCompatibilityAdapter";
import { adaptGuandanServerMessageWithRealTestFixes } from "./guandanRealTestFixes";

const card = { Suited: { suit: "Clubs", rank: "Four" } };
const snapshot = (overrides: Record<string, unknown> = {}) =>
  ({
    type: "state",
    match_id: 7,
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
    tribute_resisted: true,
    match_winner: null,
    next_round_phase: null,
    ...overrides,
  }) as any;

test("delayed resisted snapshots after first play must not reopen the notice", () => {
  const adapt = adaptGuandanServerMessageWithRealTestFixes;
  const dealt = adapt(initialGuandanTableState, snapshot());
  expect(dealt.tributeResisted).toBe(true);
  const played = adapt(
    dealt,
    snapshot({
      last_play: [card],
      last_player: 0,
      table_plays: [{ player: 0, cards: [card] }],
    }),
  );
  expect(played.tributeResisted).toBe(false);
  const cleared = adapt(played, snapshot({ table_clear_id: 1 }));
  expect(cleared.tributeResisted).toBe(false);
});
