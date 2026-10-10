//! Full-game regression harness for four-player Guandan.
include!("guandan_full_game_qa_actions.rs");
include!("guandan_full_game_qa_pass.rs");
include!("guandan_full_game_qa_loop.rs");
include!("guandan_full_game_qa_jokers.rs");
include!("guandan_full_game_qa_give.rs");
include!("guandan_full_game_qa_exchange.rs");

fn qa_next_deal(game: &mut GuandanGameState, resist: bool) {
    let table = TableConfig::new(4).unwrap();
    assert_eq!(game.next_round_phase, Some(GuandanNextRoundPhase::AwaitingShuffle));
    let deck = build_deck(table);
    assert_eq!(deck.len(), 108);
    let (mut hands, remainder) = deal(table, &deck).unwrap();
    assert!(remainder.is_empty());
    let plan = tribute_plan(table, &game.next_round_finish_order).unwrap().unwrap();
    let target = match &plan {
        TributePlan::Single { giver, receiver } => if resist { *giver } else { *receiver },
        TributePlan::Double { givers, receivers } => if resist { givers[0] } else { receivers[0] },
        _ => unreachable!(),
    };
    qa_place_big_jokers(&mut hands, target);
    assert_eq!(can_resist_tribute(&plan, &hands), resist);
    game.hands = hands;
    game.next_round_phase = None;
    game.finish_order.clear();
    game.next_round_finish_order.clear();
    game.tribute_cards.clear();
    game.return_cards.clear();
    game.pending_tribute = if resist { None } else { Some(plan.clone()) };
    game.tribute_resisted = resist;
    if !resist { qa_exchange_tribute(game, &plan); }
    assert!(game.hands.iter().all(|hand| hand.len() == CARDS_PER_PLAYER));
    assert!(!game.normal_play_blocked());
}
