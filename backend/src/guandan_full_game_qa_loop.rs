fn qa_play_full_deal(game: &mut GuandanGameState, round: usize) {
    let mut plays = 0usize;
    let mut passes = 0usize;
    for step in 0..3000 {
        if game.next_round_phase == Some(GuandanNextRoundPhase::AwaitingShuffle) {
            assert!(plays > 0, "round {round} ended without a play");
            assert_eq!(game.finish_order.len(), 4);
            assert!(game.last_game_winner.is_some());
            assert!(!game.tribute_resisted);
            eprintln!("full deal {round}: {plays} plays, {passes} passes, {step} turns");
            return;
        }
        assert!(game.started);
        assert!(game.match_winner.is_none());
        let seat = game.turn;
        assert!(seat < 4);
        assert!(!game.hands[seat].is_empty(), "empty seat has turn");
        let index = game.hands[seat].iter().position(|card| {
            validate_play_against_table(&[*card], &game.last_play, game.level).is_ok()
        });
        if let Some(index) = index {
            qa_play(game, seat, index);
            plays += 1;
            assert!(!game.tribute_resisted, "resistance repeated after play");
        } else {
            qa_pass(game, seat);
            passes += 1;
        }
    }
    panic!("round {round} exceeded 3000 turns");
}
