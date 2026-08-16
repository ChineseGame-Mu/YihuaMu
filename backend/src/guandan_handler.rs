//! Guandan websocket room protocol skeleton.
//!
//! This file is intentionally separate from `shengji_handler.rs` so the
//! existing Shengji/Finding-Friends paths remain untouched while the desktop
//! Guandan test table is wired up.

use serde::{Deserialize, Serialize};
use shengji_core::guandan::TableConfig;

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GuandanClientMessage {
    Join { room: String, name: String },
    Start { player_count: usize },
    Play { card_indexes: Vec<usize> },
    Pass,
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GuandanServerMessage {
    Joined { room: String, seat: usize },
    Waiting { players: Vec<String>, minimum_players: usize, maximum_players: usize },
    Started { player_count: usize, cards_per_player: usize },
    Turn { seat: usize },
    Error { message: String },
}

pub fn validate_start(player_count: usize) -> Result<TableConfig, &'static str> {
    let table = TableConfig::new(player_count)?;
    if !table.is_even_table() {
        return Err("first multiplayer test supports even tables: 4, 6, 8, 10, 12, 14");
    }
    Ok(table)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_even_test_tables() {
        for count in [4usize, 6, 8, 10, 12, 14] {
            assert_eq!(validate_start(count).unwrap().player_count, count);
        }
    }

    #[test]
    fn rejects_odd_tables_for_first_network_test() {
        for count in [5usize, 7, 9, 11, 13] { assert!(validate_start(count).is_err()); }
    }
}
