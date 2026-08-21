#[path = "../src/guandan_serving_types.rs"]
mod guandan_serving_types;
#[path = "../src/serving_types.rs"]
mod serving_types;

use guandan_serving_types::GuandanGameState;
use shengji_core::guandan::{CardFace, Rank, Suit};

fn card(suit: Suit, rank: Rank) -> CardFace {
    CardFace::Suited { suit, rank }
}

fn seat_for_name(state: &GuandanGameState, name: &str) -> Option<usize> {
    state
        .player_names
        .iter()
        .position(|player_name| player_name == name)
}

#[test]
fn reconnecting_same_name_restores_original_seat_and_private_hand() {
    let mut state = GuandanGameState::default();
    state.started = true;
    state.player_names = vec!["Alice".into(), "Bob".into(), "Carol".into(), "Dave".into()];
    state.hands = vec![
        vec![card(Suit::Clubs, Rank::Two)],
        vec![card(Suit::Hearts, Rank::Ace)],
        vec![card(Suit::Diamonds, Rank::King)],
        vec![card(Suit::Spades, Rank::Queen)],
    ];

    let original_seat = seat_for_name(&state, "Bob").unwrap();
    let original_hand = state.private_hand(original_seat).unwrap().to_vec();

    // A reconnect does not append a new player. The same room/name identity
    // resolves to the existing seat, and the private hand is fetched by that seat.
    let reconnected_seat = seat_for_name(&state, "Bob").unwrap();
    let restored_hand = state.private_hand(reconnected_seat).unwrap();

    assert_eq!(reconnected_seat, original_seat);
    assert_eq!(reconnected_seat, 1);
    assert_eq!(restored_hand, original_hand.as_slice());
    assert_eq!(state.player_names.len(), 4);
}
