from pathlib import Path


def rep(path: str, old: str, new: str) -> None:
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f"missing anchor: {path}: {old[:120]!r}")
    p.write_text(s.replace(old, new, 1))


rep("backend/src/guandan_serving_types.rs", "    #[serde(default)]\n    pub last_trick_winner: Option<usize>,\n    pub level: Rank,", "    #[serde(default)]\n    pub last_trick_winner: Option<usize>,\n    #[serde(default)]\n    pub initial_draw: Vec<CardFace>,\n    #[serde(default)]\n    pub initial_draw_winner: Option<usize>,\n    pub level: Rank,")
rep("backend/src/guandan_serving_types.rs", "            last_trick_winner: None,\n            level: Rank::Two,", "            last_trick_winner: None,\n            initial_draw: Vec::new(),\n            initial_draw_winner: None,\n            level: Rank::Two,")

rep("backend/src/guandan_handler.rs", "    CardFace, Rank, TableConfig,\n};", "    CardFace, Joker, Rank, Suit, TableConfig,\n};")
rep("backend/src/guandan_handler.rs", "        last_trick_winner: Option<usize>,\n        level: Rank,", "        last_trick_winner: Option<usize>,\n        initial_draw: Vec<CardFace>,\n        initial_draw_winner: Option<usize>,\n        level: Rank,")
rep("backend/src/guandan_handler.rs", "        last_trick_winner: game.last_trick_winner,\n        level: game.level,", "        last_trick_winner: game.last_trick_winner,\n        initial_draw: game.initial_draw.clone(),\n        initial_draw_winner: game.initial_draw_winner,\n        level: game.level,")
rep("backend/src/guandan_handler.rs", "use rand::{thread_rng, Rng};", "use rand::thread_rng;")

rep("backend/src/guandan_handler.rs", '''fn roll_starting_seat<R: Rng + ?Sized>(rng: &mut R) -> usize {
    loop {
        let roll = rng.gen_range(1..=6);
        if roll <= GUANDAN_PLAYER_COUNT {
            return roll - 1;
        }
    }
}''', '''fn initial_draw_value(card: CardFace) -> usize {
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

fn draw_starting_seat(deck: &mut Vec<CardFace>) -> (Vec<CardFace>, usize) {
    loop {
        deck.shuffle(&mut thread_rng());
        let draw = deck.iter().copied().take(GUANDAN_PLAYER_COUNT).collect::<Vec<_>>();
        let values = draw.iter().copied().map(initial_draw_value).collect::<Vec<_>>();
        let max_value = *values.iter().max().expect("Guandan deck has cards");
        if values.iter().filter(|value| **value == max_value).count() == 1 {
            let winner = values.iter().position(|value| *value == max_value).expect("unique winner");
            return (draw, winner);
        }
    }
}''')

rep("backend/src/guandan_handler.rs", "                        state.game.started = true;\n                        state.game.hands = hands;\n                        state.game.turn = roll_starting_seat(&mut rng);", "                        let mut draw_deck = build_deck(table);\n                        let (initial_draw, draw_winner) = draw_starting_seat(&mut draw_deck);\n                        state.game.started = true;\n                        state.game.hands = hands;\n                        state.game.turn = draw_winner;\n                        state.game.initial_draw = initial_draw;\n                        state.game.initial_draw_winner = Some(draw_winner);")

rep("backend/src/guandan_handler.rs", '''    #[test]
    fn dice_starting_seat_is_always_a_real_player() {
        let mut rng = thread_rng();
        for _ in 0..512 {
            assert!(roll_starting_seat(&mut rng) < GUANDAN_PLAYER_COUNT);
        }
    }''', '''    #[test]
    fn initial_draw_always_selects_a_real_player() {
        let table = validate_start(4).unwrap();
        for _ in 0..128 {
            let mut deck = build_deck(table);
            let (draw, winner) = draw_starting_seat(&mut deck);
            assert_eq!(draw.len(), 4);
            assert!(winner < GUANDAN_PLAYER_COUNT);
        }
    }''')

rep("frontend/src/guandanProtocol.ts", "      last_trick_winner: number | null;\n      level: GuandanRank;", "      last_trick_winner: number | null;\n      initial_draw: GuandanCard[];\n      initial_draw_winner: number | null;\n      level: GuandanRank;")
rep("frontend/src/GuandanStateProvider.tsx", "  lastTrickWinner: number | null;\n  level: GuandanRank | null;", "  lastTrickWinner: number | null;\n  initialDraw: GuandanCard[];\n  initialDrawWinner: number | null;\n  level: GuandanRank | null;")
rep("frontend/src/GuandanStateProvider.tsx", "  lastTrickWinner: null,\n  level: null,", "  lastTrickWinner: null,\n  initialDraw: [],\n  initialDrawWinner: null,\n  level: null,")
rep("frontend/src/GuandanStateProvider.tsx", "        lastTrickWinner: null,\n        finishOrder: [],", "        lastTrickWinner: null,\n        initialDraw: [],\n        initialDrawWinner: null,\n        finishOrder: [],")
rep("frontend/src/GuandanStateProvider.tsx", "        lastTrickWinner: message.last_trick_winner,\n        level: message.level,", "        lastTrickWinner: message.last_trick_winner,\n        initialDraw: message.initial_draw,\n        initialDrawWinner: message.initial_draw_winner,\n        level: message.level,")

rep("frontend/src/GuandanTable.tsx", '            <aside className="guandan-scoreboard" aria-label="当前级数">', '''            {state.initialDraw.length === 4 &&
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
                  <div><strong>首出：</strong>{state.players[state.initialDrawWinner] ?? `玩家${state.initialDrawWinner + 1}`}</div>
                </div>
              )}
            <aside className="guandan-scoreboard" aria-label="当前级数">''')
rep("frontend/src/GuandanTable.tsx", "                  开始四人局\n                </button>", "                  抽牌决定首家并开始四人局\n                </button>")
