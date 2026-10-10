fn qa_give_tribute(game: &mut GuandanGameState, giver: usize) {
    let index = (0..game.hands[giver].len())
        .find(|i| game.clone().submit_tribute_card(giver, *i).is_ok())
        .unwrap();
    game.submit_tribute_card(giver, index).unwrap();
}
