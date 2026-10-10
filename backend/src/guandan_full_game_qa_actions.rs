use super::*;
fn qa_play(game: &mut GuandanGameState, seat: usize, index: usize) {
    assert!(!game.normal_play_blocked());
    assert_eq!(game.turn, seat);
    let selected = game.hands[seat][index];
    validate_play_against_table(&[selected], &game.last_play, game.level).unwrap();
    game.hands[seat].remove(index);
    game.tribute_resisted = false;
    game.last_play = vec![selected];
    game.last_player = Some(seat);
    game.table_plays.push(GuandanTablePlay { player: seat, cards: vec![selected] });
    game.passes = 0;
    if game.hands[seat].is_empty() && !game.finish_order.contains(&seat) {
        game.finish_order.push(seat);
    }
    if !settle_and_redeal_if_complete(game).unwrap() {
        advance_turn(game);
    }
}
