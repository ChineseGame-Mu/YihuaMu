from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)

backend = Path("backend/src/guandan_handler.rs")
s = backend.read_text()

s = replace_once(
    s,
    "const GUANDAN_PLAYER_COUNT: usize = 4;",
    "const GUANDAN_MIN_PLAYER_COUNT: usize = 4;\nconst GUANDAN_MAX_PLAYER_COUNT: usize = 14;\nconst GUANDAN_CLASSIC_PLAYER_COUNT: usize = 4;",
    "player constants",
)
s = replace_once(
    s,
    '''pub fn validate_start(player_count: usize) -> Result<TableConfig, &'static str> {\n    if player_count != GUANDAN_PLAYER_COUNT {\n        return Err("Guandan requires exactly 4 players");\n    }\n    TableConfig::new(player_count)\n}''',
    '''pub fn validate_start(player_count: usize) -> Result<TableConfig, &'static str> {\n    if !(GUANDAN_MIN_PLAYER_COUNT..=GUANDAN_MAX_PLAYER_COUNT).contains(&player_count)\n        || !player_count.is_multiple_of(2)\n    {\n        return Err("Guandan requires an even player count from 4 through 14");\n    }\n    TableConfig::new(player_count)\n}''',
    "validate_start",
)
s = s.replace("minimum_players: GUANDAN_PLAYER_COUNT,", "minimum_players: GUANDAN_MIN_PLAYER_COUNT,")
s = s.replace("maximum_players: GUANDAN_PLAYER_COUNT,", "maximum_players: GUANDAN_MAX_PLAYER_COUNT,")
s = s.replace("state.game.player_names.len() >= GUANDAN_PLAYER_COUNT", "state.game.player_names.len() >= GUANDAN_MAX_PLAYER_COUNT")
s = s.replace("human_count + count > GUANDAN_PLAYER_COUNT", "human_count + count > GUANDAN_CLASSIC_PLAYER_COUNT")

s = replace_once(
    s,
    "fn draw_starting_seat(deck: &mut Vec<CardFace>) -> (Vec<CardFace>, usize) {",
    "fn draw_starting_seat(\n    deck: &mut Vec<CardFace>,\n    player_count: usize,\n) -> (Vec<CardFace>, usize) {",
    "draw signature",
)
s = s.replace(".take(GUANDAN_PLAYER_COUNT)", ".take(player_count)", 1)
s = replace_once(
    s,
    "let (initial_draw, draw_winner) = draw_starting_seat(&mut draw_deck);",
    "let (initial_draw, draw_winner) =\n                            draw_starting_seat(&mut draw_deck, table.player_count);",
    "start draw call",
)

helper = '''fn settle_multiplayer_if_complete(\n    game: &mut GuandanGameState,\n) -> Result<bool, &'static str> {\n    let player_count = game.hands.len();\n    if player_count <= GUANDAN_CLASSIC_PLAYER_COUNT\n        || player_count > GUANDAN_MAX_PLAYER_COUNT\n        || !player_count.is_multiple_of(2)\n    {\n        return Err("expanded Guandan settlement requires 6 to 14 even players");\n    }\n    if game.finish_order.len() == player_count - 1 {\n        let last_seat = (0..player_count)\n            .find(|seat| !game.finish_order.contains(seat))\n            .ok_or("unable to determine final place")?;\n        game.finish_order.push(last_seat);\n        game.hands[last_seat].clear();\n    }\n    if game.hands.iter().any(|hand| !hand.is_empty()) || game.finish_order.is_empty() {\n        return Ok(false);\n    }\n    if game.finish_order.len() != player_count {\n        return Err("expanded Guandan settlement requires a complete finish order");\n    }\n    let winner = *game.finish_order.first().ok_or("finish order is empty")?;\n    let winner_team = if winner % 2 == 0 { Team::A } else { Team::B };\n    let winner_level = game.team_levels.level_for(winner_team);\n    game.last_game_winner = Some(winner);\n    game.last_game_winner_team = Some(winner_team);\n    game.last_promotion_steps = Some(1);\n    if winner_level == Rank::Ace {\n        game.match_winner = Some(winner_team);\n        game.trick_complete = true;\n        return Ok(true);\n    }\n    game.level = game.team_levels.advance_winner(winner_team);\n    game.turn = winner;\n    game.next_round_finish_order = game.finish_order[..player_count - 1].to_vec();\n    game.next_round_phase = Some(GuandanNextRoundPhase::AwaitingShuffle);\n    game.last_play.clear();\n    game.last_player = None;\n    game.table_plays.clear();\n    game.passes = 0;\n    game.trick_complete = false;\n    game.last_trick_winner = None;\n    game.pending_tribute = None;\n    game.tribute_cards.clear();\n    game.return_cards.clear();\n    game.tribute_resisted = false;\n    Ok(true)\n}\n\n'''
anchor = "fn settle_and_redeal_if_complete(game: &mut GuandanGameState) -> Result<bool, &'static str> {"
if "fn settle_multiplayer_if_complete(" not in s:
    if anchor not in s:
        raise SystemExit("missing anchor: settlement")
    s = s.replace(anchor, helper + anchor, 1)
s = replace_once(
    s,
    '    if player_count != GUANDAN_PLAYER_COUNT {\n        return Err("Guandan settlement requires exactly four players");\n    }',
    '    if player_count != GUANDAN_CLASSIC_PLAYER_COUNT {\n        return settle_multiplayer_if_complete(game);\n    }',
    "classic settlement guard",
)

old_tribute = '''                        let plan =\n                            four_player_tribute_plan(table, &state.game.next_round_finish_order)\n                                .map_err(PlayError::Invalid)?;\n                        if can_resist_tribute(&plan, &state.game.hands) {\n                            state.game.tribute_resisted = true;\n                        } else {\n                            state.game.pending_tribute = Some(plan);\n                        }'''
new_tribute = '''                        if table.player_count == GUANDAN_CLASSIC_PLAYER_COUNT {\n                            let plan = four_player_tribute_plan(\n                                table,\n                                &state.game.next_round_finish_order,\n                            )\n                            .map_err(PlayError::Invalid)?;\n                            if can_resist_tribute(&plan, &state.game.hands) {\n                                state.game.tribute_resisted = true;\n                            } else {\n                                state.game.pending_tribute = Some(plan);\n                            }\n                        } else {\n                            state.game.pending_tribute = None;\n                            state.game.tribute_resisted = false;\n                        }'''
s = replace_once(s, old_tribute, new_tribute, "tribute split")
s = s.replace(
    '"the game is already underway or four seated players are required"',
    '"the game is already underway or the requested seated player count is not ready"',
)

s = s.replace(
    "let (draw, winner) = draw_starting_seat(&mut deck);\n            assert_eq!(draw.len(), 4);\n            assert!(winner < GUANDAN_PLAYER_COUNT);",
    "let (draw, winner) = draw_starting_seat(&mut deck, 4);\n            assert_eq!(draw.len(), 4);\n            assert!(winner < GUANDAN_CLASSIC_PLAYER_COUNT);\n            assert!(draw.iter().all(|card| !matches!(card, CardFace::Joker(_))));",
)
s = s.replace(
    '''fn accepts_only_four_player_games() {\n        assert_eq!(validate_start(4).unwrap().player_count, 4);\n        for count in [3usize, 5, 6, 8, 10, 12, 14] {\n            assert!(validate_start(count).is_err());\n        }\n    }''',
    '''fn accepts_even_tables_from_four_through_fourteen() {\n        for count in [4usize, 6, 8, 10, 12, 14] {\n            assert_eq!(validate_start(count).unwrap().player_count, count);\n        }\n        for count in [3usize, 5, 7, 9, 11, 13, 15] {\n            assert!(validate_start(count).is_err());\n        }\n    }''',
)
s = s.replace("for seat in 0..GUANDAN_PLAYER_COUNT {", "for seat in 0..GUANDAN_CLASSIC_PLAYER_COUNT {", 1)
backend.write_text(s)

frontend = Path("frontend/src/GuandanTable.tsx")
f = frontend.read_text()
f = replace_once(
    f,
    '  const testMode = query.get("test") === "1";\n  const playerCount = state.playerCount ?? state.players.length;',
    '''  const testMode = query.get("test") === "1";\n  const supportedPlayerCounts = [4, 6, 8, 10, 12, 14] as const;\n  const queryPlayerCount = Number(query.get("players") ?? "4");\n  const [requestedPlayerCount, setRequestedPlayerCount] = React.useState<number>(\n    supportedPlayerCounts.includes(\n      queryPlayerCount as (typeof supportedPlayerCounts)[number],\n    )\n      ? queryPlayerCount\n      : 4,\n  );\n  const playerCount = state.playerCount ?? state.players.length;''',
    "frontend table-size state",
)
f = f.replace("      state.initialDraw.length !== 4 ||", "      state.initialDraw.length !== playerCount ||", 1)
f = f.replace(
    "  }, [state.initialDraw, state.initialDrawWinner, state.lastGameWinner]);",
    "  }, [state.initialDraw, state.initialDrawWinner, state.lastGameWinner, playerCount]);",
    1,
)
f = replace_once(
    f,
    '''  const startGame = (): void => {\n    if (state.seat === null || gameStarted || state.players.length < 4) return;\n    if (send({ type: "start", player_count: 4 })) {''',
    '''  const startGame = (): void => {\n    if (\n      state.seat === null ||\n      gameStarted ||\n      state.players.length !== requestedPlayerCount\n    )\n      return;\n    if (send({ type: "start", player_count: requestedPlayerCount })) {''',
    "frontend start",
)
f = f.replace(
    '    "the game is already underway or four seated players are required":\n      "游戏已经开始，或者尚未坐满4位玩家。",',
    '    "the game is already underway or the requested seated player count is not ready":\n      "游戏已经开始，或者所选人数尚未全部到齐。",',
)
f = f.replace(
    '    url.searchParams.set("name", `玩家${player}`);',
    '    url.searchParams.set("players", String(requestedPlayerCount));\n    url.searchParams.set("name", `玩家${player}`);',
    1,
)
f = f.replace(
    '''          <h2>四人联机测试</h2>\n          <div className="guandan-actions">\n            {[1, 2, 3, 4].map((player) => (''',
    '''          <h2>{requestedPlayerCount}人联机测试</h2>\n          <label>\n            测试人数：\n            <select\n              value={requestedPlayerCount}\n              onChange={(event) => setRequestedPlayerCount(Number(event.target.value))}\n            >\n              {supportedPlayerCounts.map((count) => (\n                <option key={count} value={count}>\n                  {count} 人\n                </option>\n              ))}\n            </select>\n          </label>\n          <div className="guandan-actions">\n            {Array.from({ length: requestedPlayerCount }, (_, index) => index + 1).map((player) => (''',
    1,
)
f = f.replace("            {state.finishOrder.length === 4 && (", "            {state.finishOrder.length === playerCount && playerCount >= 4 && (", 1)
f = f.replace("              state.initialDraw.length === 4 &&", "              state.initialDraw.length === playerCount &&", 1)

marker_anchor = '''                    <strong>\n                      {index === state.seat ? `${player}（我）` : player}\n                    </strong>'''
marker = '''                    <span\n                      className="guandan-team-marker"\n                      aria-label={`队伍 ${index % 2 === 0 ? 1 : 2}`}\n                    >\n                      {index % 2 === 0 ? "1" : "2"}\n                    </span>\n                    <strong>\n                      {index === state.seat ? `${player}（我）` : player}\n                    </strong>'''
f = replace_once(f, marker_anchor, marker, "team marker")

old_panel = '''            {!gameStarted && !observing && (\n              <section className="guandan-actions guandan-start-panel">\n                <button\n                  className="guandan-start-button"\n                  disabled={state.seat === null || state.players.length < 4}\n                  onClick={startGame}\n                >\n                  抽牌决定首家并开始四人局\n                </button>\n                <strong>\n                  {state.players.length === 4\n                    ? "四位玩家已到齐，任意已入座玩家均可开始"\n                    : `等待四位玩家全部进入（当前${state.players.length}/4）`}\n                </strong>\n              </section>\n            )}'''
new_panel = '''            {!gameStarted && !observing && (\n              <section className="guandan-actions guandan-start-panel">\n                <label>\n                  本桌人数：\n                  <select\n                    value={requestedPlayerCount}\n                    onChange={(event) => setRequestedPlayerCount(Number(event.target.value))}\n                  >\n                    {supportedPlayerCounts.map((count) => (\n                      <option key={count} value={count}>\n                        {count} 人\n                      </option>\n                    ))}\n                  </select>\n                </label>\n                <button\n                  className="guandan-start-button"\n                  disabled={\n                    state.seat === null ||\n                    state.players.length !== requestedPlayerCount\n                  }\n                  onClick={startGame}\n                >\n                  抽牌决定首家并开始{requestedPlayerCount}人局\n                </button>\n                <strong>\n                  {state.players.length === requestedPlayerCount\n                    ? `${requestedPlayerCount}位玩家已到齐，任意已入座玩家均可开始`\n                    : `等待${requestedPlayerCount}位玩家全部进入（当前${state.players.length}/${requestedPlayerCount}）`}\n                </strong>\n              </section>\n            )}'''
f = replace_once(f, old_panel, new_panel, "start panel")
f = f.replace("            {state.finishOrder.length === 4 && (", "            {state.finishOrder.length === playerCount && playerCount >= 4 && (", 1)
f = f.replace("四位玩家正在同步收牌，请稍候…", "{playerCount}位玩家正在同步收牌，请稍候…")
frontend.write_text(f)

print("14-player isolated patch applied")
