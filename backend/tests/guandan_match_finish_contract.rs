#[path = "../src/guandan_serving_types.rs"]
mod guandan_serving_types;
#[path = "../src/serving_types.rs"]
mod serving_types;

use guandan_serving_types::GuandanGameState;
use shengji_core::guandan::{
    team::{four_player_ace_win, Team},
    TableConfig,
};

#[test]
fn ace_clearance_is_progressively_easier_across_three_deals() {
    let table = TableConfig::new(4).unwrap();
    assert!(four_player_ace_win(table, &[0, 2], 1).unwrap());
    assert!(!four_player_ace_win(table, &[0, 1, 2], 1).unwrap());
    assert!(!four_player_ace_win(table, &[0, 1, 3], 1).unwrap());

    assert!(four_player_ace_win(table, &[0, 2], 2).unwrap());
    assert!(four_player_ace_win(table, &[0, 1, 2], 2).unwrap());
    assert!(!four_player_ace_win(table, &[0, 1, 3], 2).unwrap());

    assert!(four_player_ace_win(table, &[0, 2], 3).unwrap());
    assert!(four_player_ace_win(table, &[0, 1, 2], 3).unwrap());
    assert!(four_player_ace_win(table, &[0, 1, 3], 3).unwrap());
}

#[test]
fn match_winner_blocks_further_normal_play() {
    let mut state = GuandanGameState::default();
    assert!(!state.normal_play_blocked());

    state.match_winner = Some(Team::A);
    assert!(state.normal_play_blocked());
}
