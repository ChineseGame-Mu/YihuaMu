from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f"missing patch anchor in {path}: {old[:160]!r}")
    p.write_text(s.replace(old, new, 1))


replace_once(
    "backend/src/guandan_serving_types.rs",
    "    #[serde(default)]\n    pub last_trick_winner: Option<usize>,\n    pub level: Rank,",
    "    #[serde(default)]\n    pub last_trick_winner: Option<usize>,\n    #[serde(default)]\n    pub initial_draw: Vec<CardFace>,\n    #[serde(default)]\n    pub initial_draw_winner: Option<usize>,\n    pub level: Rank,",
)
replace_once(
    "backend/src/guandan_serving_types.rs",
    "            last_trick_winner: None,\n            level: Rank::Two,",
    "            last_trick_winner: None,\n            initial_draw: Vec::new(),\n            initial_draw_winner: None,\n            level: Rank::Two,",
)

replace_once(
    "backend/src/guandan_handler.rs",
    "    CardFace, Rank, TableConfig,\n};",
    "    CardFace, Joker, Rank, Suit, TableConfig,\n};",
)
replace_once(
    "backend/src/guandan_handler.rs",
    "        last_trick_winner: Option<usize>, level: Rank, team_levels: TeamLevels,",
    "        last_trick_winner: Option<usize>, initial_draw: Vec<CardFace>,\n        initial_draw_winner: Option<usize>, level: Rank, team_levels: TeamLevels,",
)
replace_once(
    "backend/src/guandan_handler.rs",
    "trick_complete: game.trick_complete, last_trick_winner: game.last_trick_winner, level: game.level,",
    "trick_complete: game.trick_complete, last_trick_winner: game.last_trick_winner, initial_draw: game.initial_draw.clone(), initial_draw_winner: game.initial_draw_winner, level: game.level,",
)
replace_once(
    "backend/src/guandan_handler.rs",
    'fn is_robot_name(name: &str) -> bool { name.starts_with("机器人") }\n\nfn settle_and_redeal_if_complete',
    '''fn is_robot_name(name: &str) -> bool { name.starts_with("机器人") }

fn initial_draw_value(card: CardFace) -> usize {
    match card {
        CardFace::Joker(Joker::Big) => 1000,
        CardFace::Joker(Joker::Small) => 900,
        CardFace::Suited { suit, rank } => {
            let suit_value = match suit {
                Suit::Clubs => 0,
                Suit::Diamonds => 1,
                Suit::Spades => 2,
                Suit::Hearts => 3,
            };
            (rank as usize) * 10 + suit_value
        }
    }
}

fn settle_and_redeal_if_complete''',
)
replace_once(
    "backend/src/guandan_handler.rs",
    "let mut deck = build_deck(table); deck.shuffle(&mut thread_rng()); let (hands, remainder) = deal(table, &deck).map_err(|_| ())?; if !remainder.is_empty() { return Err(()); } state.game.started = true; state.game.hands = hands; state.game.turn = 0;",
    '''let mut draw_deck = build_deck(table);
                let (initial_draw, draw_winner) = loop {
                    draw_deck.shuffle(&mut thread_rng());
                    let draw = draw_deck.iter().copied().take(GUANDAN_PLAYER_COUNT).collect::<Vec<_>>();
                    let values = draw.iter().copied().map(initial_draw_value).collect::<Vec<_>>();
                    let max_value = values.iter().copied().max().ok_or(())?;
                    if values.iter().filter(|value| **value == max_value).count() == 1 {
                        let winner = values.iter().position(|value| *value == max_value).ok_or(())?;
                        break (draw, winner);
                    }
                };
                let mut deck = build_deck(table); deck.shuffle(&mut thread_rng());
                let (hands, remainder) = deal(table, &deck).map_err(|_| ())?;
                if !remainder.is_empty() { return Err(()); }
                state.game.started = true; state.game.hands = hands;
                state.game.turn = draw_winner;
                state.game.initial_draw = initial_draw;
                state.game.initial_draw_winner = Some(draw_winner);''',
)

replace_once(
    "frontend/src/guandanProtocol.ts",
    "      last_trick_winner: number | null;\n      level: GuandanRank;",
    "      last_trick_winner: number | null;\n      initial_draw: GuandanCard[];\n      initial_draw_winner: number | null;\n      level: GuandanRank;",
)

replace_once(
    "frontend/src/GuandanStateProvider.tsx",
    "  lastTrickWinner: number | null;\n  level: GuandanRank | null;",
    "  lastTrickWinner: number | null;\n  initialDraw: GuandanCard[];\n  initialDrawWinner: number | null;\n  level: GuandanRank | null;",
)
replace_once(
    "frontend/src/GuandanStateProvider.tsx",
    "  lastTrickWinner: null,\n  level: null,",
    "  lastTrickWinner: null,\n  initialDraw: [],\n  initialDrawWinner: null,\n  level: null,",
)
replace_once(
    "frontend/src/GuandanStateProvider.tsx",
    "        lastTrickWinner: null,\n        finishOrder: [],",
    "        lastTrickWinner: null,\n        initialDraw: [],\n        initialDrawWinner: null,\n        finishOrder: [],",
)
replace_once(
    "frontend/src/GuandanStateProvider.tsx",
    "        lastTrickWinner: message.last_trick_winner,\n        level: message.level,",
    "        lastTrickWinner: message.last_trick_winner,\n        initialDraw: message.initial_draw,\n        initialDrawWinner: message.initial_draw_winner,\n        level: message.level,",
)

replace_once(
    "frontend/src/GuandanTable.tsx",
    '            <aside className="guandan-scoreboard" aria-label="当前级数">',
    '''            {state.initialDraw.length === 4 &&
              state.initialDrawWinner !== null &&
              state.lastGameWinner === null && (
                <div className="guandan-notice-panel" role="status" aria-label="首局抽牌结果">
                  <strong>首局抽牌决定首家：</strong>
                  <div className="guandan-actions">
                    {state.initialDraw.map((card, index) => (
                      <div key={`initial-draw-${index}`}>
                        <div>{state.players[index] ?? `玩家${index + 1}`}</div>
                        {fullCard(card, 72)}
                      </div>
                    ))}
                  </div>
                  <div>
                    <strong>首出：</strong>
                    {state.players[state.initialDrawWinner] ??
                      `玩家${state.initialDrawWinner + 1}`}
                  </div>
                </div>
              )}
            <aside className="guandan-scoreboard" aria-label="当前级数">''',
)
replace_once(
    "frontend/src/GuandanTable.tsx",
    "                  开始四人局\n                </button>",
    "                  抽牌决定首家并开始四人局\n                </button>",
)
