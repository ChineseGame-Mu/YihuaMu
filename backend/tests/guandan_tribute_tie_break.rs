#[path = "../src/guandan_serving_types.rs"]
mod guandan_serving_types;
#[path = "../src/serving_types.rs"]
mod serving_types;

use guandan_serving_types::GuandanGameState;
use shengji_core::guandan::{tribute::TributePlan, CardFace, Rank, Suit};

fn card(suit: Suit, rank: Rank) -> CardFace {
    CardFace::Suited { suit, rank }
}

fn filler() -> Vec<CardFace> {
    vec![card(Suit::Clubs, Rank::Two); 27]
}

#[test]
fn equal_double_tributes_use_current_seat_order() {
    let first_tribute = card(Suit::Spades, Rank::Ace);
    let second_tribute = first_tribute;
    let first_return = card(Suit::Clubs, Rank::Ten);
    let second_return = card(Suit::Clubs, Rank::Nine);

    let mut state = GuandanGameState::default();
    state.level = Rank::Five;
    state.hands = vec![filler(), filler(), filler(), filler()];
    state.hands[0][0] = first_return;
    state.hands[2][0] = second_return;
    state.hands[1][0] = first_tribute;
    state.hands[3][0] = second_tribute;
    state.pending_tribute = Some(TributePlan::Double {
        givers: [3, 1],
        receivers: [0, 2],
    });

    state.submit_tribute_card(3, 0).unwrap();
    state.submit_tribute_card(1, 0).unwrap();
    state.submit_return_card(0, 0).unwrap();
    state.submit_return_card(2, 0).unwrap();
    state.finalize_tribute_exchange().unwrap();

    assert_eq!(state.turn, 1);
    assert!(state.hands[0].contains(&first_tribute));
    assert!(state.hands[1].contains(&first_return));
    assert!(state.hands[2].contains(&second_tribute));
    assert!(state.hands[3].contains(&second_return));
    assert!(state.hands.iter().all(|hand| hand.len() == 27));
}

#[test]
fn current_seat_order_only_breaks_equal_tribute_values() {
    let lower_seat_king = card(Suit::Clubs, Rank::King);
    let higher_seat_ace = card(Suit::Spades, Rank::Ace);
    let first_return = card(Suit::Clubs, Rank::Ten);
    let second_return = card(Suit::Clubs, Rank::Nine);

    let mut state = GuandanGameState::default();
    state.level = Rank::Five;
    state.hands = vec![filler(), filler(), filler(), filler()];
    state.hands[0][0] = first_return;
    state.hands[2][0] = second_return;
    state.hands[1][0] = lower_seat_king;
    state.hands[3][0] = higher_seat_ace;
    state.pending_tribute = Some(TributePlan::Double {
        givers: [3, 1],
        receivers: [0, 2],
    });

    state.submit_tribute_card(3, 0).unwrap();
    state.submit_tribute_card(1, 0).unwrap();
    state.submit_return_card(0, 0).unwrap();
    state.submit_return_card(2, 0).unwrap();
    state.finalize_tribute_exchange().unwrap();

    assert_eq!(state.turn, 3);
    assert!(state.hands[0].contains(&higher_seat_ace));
    assert!(state.hands[2].contains(&lower_seat_king));
    assert!(state.hands[3].contains(&first_return));
    assert!(state.hands[1].contains(&second_return));
}
