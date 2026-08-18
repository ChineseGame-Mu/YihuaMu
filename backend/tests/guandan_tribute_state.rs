#[path = "../src/serving_types.rs"]
mod serving_types;
#[path = "../src/guandan_serving_types.rs"]
mod guandan_serving_types;

use guandan_serving_types::GuandanGameState;
use shengji_core::guandan::{tribute::TributePlan, CardFace, Rank, Suit};

fn card(suit: Suit, rank: Rank) -> CardFace {
    CardFace::Suited { suit, rank }
}

fn filler() -> Vec<CardFace> {
    vec![card(Suit::Clubs, Rank::Two); 27]
}

#[test]
fn single_exchange_clears_tribute_state_and_unblocks_play() {
    let mut state = GuandanGameState::default();
    state.level = Rank::Five;
    state.hands = vec![filler(), filler(), filler(), filler()];
    state.hands[0][0] = card(Suit::Diamonds, Rank::Ten);
    state.hands[3][0] = card(Suit::Spades, Rank::Ace);
    state.pending_tribute = Some(TributePlan::Single {
        giver: 3,
        receiver: 0,
    });

    assert!(state.normal_play_blocked());
    state.submit_tribute_card(3, 0).unwrap();
    state.submit_return_card(0, 0).unwrap();
    assert!(state.tribute_exchange_complete());
    state.finalize_tribute_exchange().unwrap();

    assert_eq!(state.turn, 3);
    assert!(state.pending_tribute.is_none());
    assert!(state.tribute_cards.is_empty());
    assert!(state.return_cards.is_empty());
    assert!(state.hands.iter().all(|hand| hand.len() == 27));
    assert!(!state.normal_play_blocked());
}

#[test]
fn double_exchange_clears_tribute_state_and_high_giver_opens() {
    let mut state = GuandanGameState::default();
    state.level = Rank::Five;
    state.hands = vec![filler(), filler(), filler(), filler()];
    state.hands[0][0] = card(Suit::Diamonds, Rank::Ten);
    state.hands[2][0] = card(Suit::Diamonds, Rank::Nine);
    state.hands[1][0] = card(Suit::Spades, Rank::King);
    state.hands[3][0] = card(Suit::Spades, Rank::Ace);
    state.pending_tribute = Some(TributePlan::Double {
        givers: [1, 3],
        receivers: [0, 2],
    });

    assert!(state.normal_play_blocked());
    state.submit_tribute_card(1, 0).unwrap();
    state.submit_tribute_card(3, 0).unwrap();
    state.submit_return_card(0, 0).unwrap();
    state.submit_return_card(2, 0).unwrap();
    assert!(state.tribute_exchange_complete());
    state.finalize_tribute_exchange().unwrap();

    assert_eq!(state.turn, 3);
    assert!(state.pending_tribute.is_none());
    assert!(state.tribute_cards.is_empty());
    assert!(state.return_cards.is_empty());
    assert!(state.hands.iter().all(|hand| hand.len() == 27));
    assert!(!state.normal_play_blocked());
}
