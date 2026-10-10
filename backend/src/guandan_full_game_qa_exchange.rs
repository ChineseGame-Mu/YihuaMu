fn qa_exchange_tribute(game: &mut GuandanGameState, plan: &TributePlan) {
    let (givers, receivers) = match plan {
        TributePlan::Single { giver, receiver } => (vec![*giver], vec![*receiver]),
        TributePlan::Double { givers, receivers } => (givers.to_vec(), receivers.to_vec()),
        _ => unreachable!(),
    };
    for giver in givers { qa_give_tribute(game, giver); }
    for receiver in receivers {
        let index = (0..game.hands[receiver].len())
            .find(|i| game.clone().submit_return_card(receiver, *i).is_ok()).unwrap();
        game.submit_return_card(receiver, index).unwrap();
    }
    assert!(game.tribute_exchange_complete());
    game.finalize_tribute_exchange().unwrap();
    assert!(game.pending_tribute.is_none());
}
