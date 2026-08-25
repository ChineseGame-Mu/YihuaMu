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

anchor = '''fn is_robot_name(name: &str) -> bool {
    name.starts_with("机器人")
}
'''
insert = '''fn is_robot_name(name: &str) -> bool {
    name.starts_with("机器人")
}

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
}
'''
rep("backend/src/guandan_handler.rs", anchor, insert)

rep("backend/src/guandan_handler.rs", "                        state.game.started = true;\n                        state.game.hands = hands;\n                        state.game.turn = 0;", "                        let mut draw_deck = build_deck(table);\n                        let (initial_draw, draw_winner) = draw_starting_seat(&mut draw_deck);\n                        state.game.started = true;\n                        state.game.hands = hands;\n                        state.game.turn = draw_winner;\n                        state.game.initial_draw = initial_draw;\n                        state.game.initial_draw_winner = Some(draw_winner);")
