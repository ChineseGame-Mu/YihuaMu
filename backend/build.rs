use std::{fs, path::Path};

fn main() {
    println!("cargo:rerun-if-changed=src/guandan_handler.rs");

    let path = Path::new("src/guandan_handler.rs");
    let Ok(mut source) = fs::read_to_string(path) else {
        return;
    };

    // Cleanroom hotfix: when a trick winner has already played the last card in
    // their hand, classic four-player Guandan gives the next lead to that
    // winner's partner (借东风). Falling back to normal seat-order advancement
    // incorrectly hands the lead to an opponent.
    let advance_turn = r#"fn advance_turn(game: &mut GuandanGameState) {
    if game.hands.is_empty() {
        return;
    }
    for _ in 0..game.hands.len() {
        game.turn = (game.turn + 1) % game.hands.len();
        if !game.hands[game.turn].is_empty() {
            break;
        }
    }
}
"#;
    let advance_turn_with_borrow = r#"fn advance_turn(game: &mut GuandanGameState) {
    if game.hands.is_empty() {
        return;
    }
    for _ in 0..game.hands.len() {
        game.turn = (game.turn + 1) % game.hands.len();
        if !game.hands[game.turn].is_empty() {
            break;
        }
    }
}

// 借东风: if the completed-trick winner is already out, their partner leads
// the next trick. In classic 4-player Guandan partners sit opposite each other.
fn assign_next_trick_leader(game: &mut GuandanGameState, winner: usize) {
    if game.hands.is_empty() || winner >= game.hands.len() {
        return;
    }
    game.turn = winner;
    if !game.hands[winner].is_empty() {
        return;
    }
    if game.hands.len() == GUANDAN_CLASSIC_PLAYER_COUNT {
        let partner = (winner + 2) % GUANDAN_CLASSIC_PLAYER_COUNT;
        if !game.hands[partner].is_empty() {
            game.turn = partner;
            return;
        }
    }
    advance_turn(game);
}
"#;
    if !source.contains("fn assign_next_trick_leader(") {
        let Some(start) = source.find(advance_turn) else {
            panic!("Guandan borrow-east-wind patch anchor missing: advance_turn");
        };
        source.replace_range(start..start + advance_turn.len(), advance_turn_with_borrow);
    }

    // All completed-trick paths (human pass, robot pass, EndRound collection)
    // must use the same authoritative leader-transfer rule.
    let old_winner_handoff = r#"            game.turn = winner;
            if game.hands[winner].is_empty() {
                advance_turn(game);
            }
"#;
    let new_winner_handoff = r#"            assign_next_trick_leader(game, winner);
"#;
    source = source.replace(old_winner_handoff, new_winner_handoff);

    let old_state_handoff = r#"                        state.game.turn = winner;
                        if state.game.hands[winner].is_empty() {
                            advance_turn(&mut state.game);
                        }
"#;
    let new_state_handoff = r#"                        assign_next_trick_leader(&mut state.game, winner);
"#;
    source = source.replace(old_state_handoff, new_state_handoff);

    // Cleanroom hotfix: after a completed trick is collected, the next leader can
    // be a robot. The normal Play/Pass paths already call run_robot_turns(), but
    // EndRound did not, leaving an empty table stuck on "机器人N".
    let end_round = "            GuandanClientMessage::EndRound => {\n                let key = match joined_room.clone() {\n                    Some(key) => key,\n                    None => continue,\n                };\n                let result = storage\n";
    let end_round_fixed = "            GuandanClientMessage::EndRound => {\n                let key = match joined_room.clone() {\n                    Some(key) => key,\n                    None => continue,\n                };\n                let hook_to_bottom = hook_to_bottom_for(&key);\n                let result = storage\n";

    if let Some(start) = source.find(end_round) {
        source.replace_range(start..start + end_round.len(), end_round_fixed);
    }

    let Some(end_round_start) = source.find("            GuandanClientMessage::EndRound => {")
    else {
        panic!("Guandan EndRound patch anchor missing");
    };
    let reset = "                        state.game.passes = 0;\n                        state.game.trick_complete = false;\n                        state.bump_version();\n";
    let reset_fixed = "                        state.game.passes = 0;\n                        state.game.trick_complete = false;\n                        run_robot_turns(&mut state.game, hook_to_bottom).map_err(|_| ())?;\n                        state.bump_version();\n";
    if let Some(relative) = source[end_round_start..].find(reset) {
        let start = end_round_start + relative;
        source.replace_range(start..start + reset.len(), reset_fixed);
    }

    // Inject behavioral regression tests into the backend test module so the
    // production build-time patch and the rule itself are tested together.
    if !source.contains("borrow_east_wind_finished_winner_gives_lead_to_partner_all_seats") {
        let test_anchor = r#"    #[test]
    fn initial_draw_always_selects_a_real_player() {
"#;
        let regression = r#"    #[test]
    fn borrow_east_wind_finished_x2_gives_next_lead_to_x4() {
        let mut game = GuandanGameState::default();
        game.hands = vec![
            vec![card(Suit::Clubs, Rank::Three)],
            vec![],
            vec![card(Suit::Diamonds, Rank::Four)],
            vec![card(Suit::Spades, Rank::Five)],
        ];

        // x2 is zero-based seat 1; x4 is its opposite-seat partner, seat 3.
        assign_next_trick_leader(&mut game, 1);
        assert_eq!(game.turn, 3, "finished x2 must borrow the east wind to x4");

        // Control: a winner that still has cards keeps the lead.
        game.hands[1].push(card(Suit::Hearts, Rank::Six));
        assign_next_trick_leader(&mut game, 1);
        assert_eq!(game.turn, 1, "non-finished winner must keep the next lead");

        // Mandatory matrix: the same partner-transfer rule must hold from every
        // possible winner seat, so fixing x2 cannot regress x1/x3/x4.
        for winner in 0..GUANDAN_CLASSIC_PLAYER_COUNT {
            let partner = (winner + 2) % GUANDAN_CLASSIC_PLAYER_COUNT;
            let mut matrix_game = GuandanGameState::default();
            matrix_game.hands = vec![
                vec![card(Suit::Clubs, Rank::Three)],
                vec![card(Suit::Diamonds, Rank::Four)],
                vec![card(Suit::Hearts, Rank::Five)],
                vec![card(Suit::Spades, Rank::Six)],
            ];
            matrix_game.hands[winner].clear();
            assign_next_trick_leader(&mut matrix_game, winner);
            assert_eq!(
                matrix_game.turn,
                partner,
                "mandatory 借东风 matrix failed: winner seat {} must give lead to partner seat {}",
                winner + 1,
                partner + 1
            );
        }
    }

    #[test]
    fn borrow_east_wind_finished_winner_gives_lead_to_partner_all_seats() {
        for winner in 0..GUANDAN_CLASSIC_PLAYER_COUNT {
            let partner = (winner + 2) % GUANDAN_CLASSIC_PLAYER_COUNT;
            let mut game = GuandanGameState::default();
            game.hands = vec![
                vec![card(Suit::Clubs, Rank::Three)],
                vec![card(Suit::Diamonds, Rank::Four)],
                vec![card(Suit::Hearts, Rank::Five)],
                vec![card(Suit::Spades, Rank::Six)],
            ];
            game.hands[winner].clear();

            assign_next_trick_leader(&mut game, winner);
            assert_eq!(
                game.turn,
                partner,
                "finished winner seat {} must transfer next lead to partner seat {}",
                winner + 1,
                partner + 1
            );
        }
    }

    #[test]
    fn initial_draw_always_selects_a_real_player() {
"#;
        let Some(start) = source.find(test_anchor) else {
            panic!("Guandan borrow-east-wind regression-test anchor missing");
        };
        source.replace_range(start..start + test_anchor.len(), regression);
    }

    if !source.contains("assign_next_trick_leader(&mut state.game, winner);")
        || !source.contains("borrow_east_wind_finished_x2_gives_next_lead_to_x4")
        || !source.contains("borrow_east_wind_finished_winner_gives_lead_to_partner_all_seats")
    {
        panic!("Guandan borrow-east-wind patch did not install completely");
    }

    fs::write(path, source).expect("write cleanroom Guandan turn-rule hotfixes");
}
