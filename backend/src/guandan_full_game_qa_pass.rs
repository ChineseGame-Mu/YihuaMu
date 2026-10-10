fn qa_pass(game: &mut GuandanGameState, seat: usize) {
    assert!(!game.normal_play_blocked());
    assert_eq!(game.turn, seat);
    assert!(game.last_player.is_some());
    game.passes += 1;
    let winner = game.last_player.unwrap();
    let required_passes = game.hands.iter().enumerate()
        .filter(|(index, hand)| *index != winner && !hand.is_empty()).count();
    if game.passes >= required_passes {
        game.last_trick_winner = Some(winner);
        game.turn = winner;
        if game.hands[winner].is_empty() { advance_turn(game); }
        game.last_play.clear();
        game.last_player = None;
        game.table_plays.clear();
        game.passes = 0;
        game.trick_complete = false;
    } else {
        advance_turn(game);
    }
}
