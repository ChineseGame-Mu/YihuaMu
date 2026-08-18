#[path = "../src/serving_types.rs"]
mod serving_types;
#[path = "../src/guandan_serving_types.rs"]
mod guandan_serving_types;

use guandan_serving_types::GuandanGameState;
use shengji_core::guandan::{CardFace, Joker, Rank, Suit};

fn card(suit: Suit, rank: Rank) -> CardFace {
    CardFace::Suited { suit, rank }
}

fn filler() -> Vec<CardFace> {
    vec![card(Suit::Clubs, Rank::Two); 27]
}

#[test]
fn resisted_single_tribute_keeps_winner_open_and_play_unblocked() {
    let winner = 0;
    let giver = 3;
    let mut state = GuandanGameState::default();
    state.started = true;
    state.hands = vec![filler(), filler(), filler(), filler()];
    state.hands[giver][0] = CardFace::Joker(Joker::Big);
    state.hands[giver][1] = CardFace::Joker(Joker::Big);
    state.last_game_winner = Some(winner);
    state.turn = winner;
    state.tribute_resisted = true;
    state.pending_tribute = None;

    assert!(state.tribute_resisted);
    assert!(state.pending_tribute.is_none());
    assert!(state.tribute_cards.is_empty());
    assert!(state.return_cards.is_empty());
    assert_eq!(state.hand_counts(), vec![27, 27, 27, 27]);
    assert_eq!(state.turn, winner);
    assert!(!state.normal_play_blocked());
}

#[test]
fn resisted_double_tribute_keeps_winner_open_and_skips_exchange() {
    let winner = 2;
    let mut state = GuandanGameState::default();
    state.started = true;
    state.hands = vec![filler(), filler(), filler(), filler()];
    state.hands[1][0] = CardFace::Joker(Joker::Big);
    state.hands[3][0] = CardFace::Joker(Joker::Big);
    state.last_game_winner = Some(winner);
    state.turn = winner;
    state.tribute_resisted = true;
    state.pending_tribute = None;

    assert!(state.tribute_resisted);
    assert!(state.pending_tribute.is_none());
    assert!(state.tribute_cards.is_empty());
    assert!(state.return_cards.is_empty());
    assert_eq!(state.hand_counts(), vec![27, 27, 27, 27]);
    assert_eq!(state.turn, winner);
    assert!(!state.normal_play_blocked());
}
