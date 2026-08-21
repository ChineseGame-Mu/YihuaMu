#[path = "../src/guandan_serving_types.rs"]
mod guandan_serving_types;
#[path = "../src/serving_types.rs"]
mod serving_types;

use guandan_serving_types::GuandanGameState;
use shengji_core::guandan::{
    team::{four_player_promotion_steps, Team, TeamLevels},
    tribute::{four_player_tribute_plan, TributePlan},
    CardFace, Rank, Suit, TableConfig,
};

fn card(suit: Suit, rank: Rank) -> CardFace {
    CardFace::Suited { suit, rank }
}

fn filler() -> Vec<CardFace> {
    vec![card(Suit::Clubs, Rank::Two); 27]
}

#[test]
fn one_two_finish_promotes_three_levels_then_completes_double_tribute() {
    let table = TableConfig::new(4).unwrap();
    let finish_order = [0, 2, 1];

    let steps = four_player_promotion_steps(table, &finish_order).unwrap();
    assert_eq!(steps, 3);

    let mut levels = TeamLevels::default();
    assert_eq!(levels.advance_winner_by(Team::A, steps), Rank::Five);
    assert_eq!(levels.team_a, Rank::Five);
    assert_eq!(levels.team_b, Rank::Two);

    let plan = four_player_tribute_plan(table, &finish_order).unwrap();
    assert_eq!(
        plan,
        TributePlan::Double {
            givers: [1, 3],
            receivers: [0, 2],
        }
    );

    let high_tribute = card(Suit::Spades, Rank::Ace);
    let low_tribute = card(Suit::Spades, Rank::King);
    let first_return = card(Suit::Clubs, Rank::Ten);
    let second_return = card(Suit::Clubs, Rank::Nine);

    let mut state = GuandanGameState::default();
    state.level = Rank::Five;
    state.team_levels = levels;
    state.hands = vec![filler(), filler(), filler(), filler()];
    state.hands[0][0] = first_return;
    state.hands[1][0] = high_tribute;
    state.hands[2][0] = second_return;
    state.hands[3][0] = low_tribute;
    state.pending_tribute = Some(plan);

    state.submit_tribute_card(1, 0).unwrap();
    state.submit_tribute_card(3, 0).unwrap();
    state.submit_return_card(0, 0).unwrap();
    state.submit_return_card(2, 0).unwrap();
    state.finalize_tribute_exchange().unwrap();

    assert_eq!(state.turn, 1);
    assert_eq!(state.team_levels.team_a, Rank::Five);
    assert_eq!(state.team_levels.team_b, Rank::Two);
    assert!(state.pending_tribute.is_none());
    assert!(state.hands[0].contains(&high_tribute));
    assert!(state.hands[1].contains(&first_return));
    assert!(state.hands[2].contains(&low_tribute));
    assert!(state.hands[3].contains(&second_return));
    assert!(state.hands.iter().all(|hand| hand.len() == 27));
}
