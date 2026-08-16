//! Guandan core scaffolding.
//!
//! This module is intentionally isolated from the existing Shengji game state.

pub mod compare;
pub mod deck;
pub mod rules;
pub mod team;
pub mod trick;

pub const MIN_PLAYERS: usize = 4;
pub const MAX_PLAYERS: usize = 14;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TableConfig { pub player_count: usize }
impl TableConfig {
    pub fn new(player_count: usize) -> Result<Self, &'static str> {
        if !(MIN_PLAYERS..=MAX_PLAYERS).contains(&player_count) { return Err("Guandan requires between 4 and 14 players"); }
        Ok(Self { player_count })
    }
    pub fn seat_numbers(self) -> impl Iterator<Item = usize> { 0..self.player_count }
    pub fn is_even_table(self) -> bool { self.player_count % 2 == 0 }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub enum Rank { Two, Three, Four, Five, Six, Seven, Eight, Nine, Ten, Jack, Queen, King, Ace }
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Suit { Clubs, Diamonds, Hearts, Spades }
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Joker { Small, Big }
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CardFace { Suited { suit: Suit, rank: Rank }, Joker(Joker) }
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PlayPattern { Single, Pair, Triple, TripleWithPair, Straight, ConsecutivePairs, ConsecutiveTriples, Bomb, StraightFlush, JokerBomb }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_every_supported_table_size() {
        for player_count in MIN_PLAYERS..=MAX_PLAYERS { assert_eq!(TableConfig::new(player_count), Ok(TableConfig { player_count })); }
    }
    #[test]
    fn rejects_tables_outside_supported_range() {
        assert!(TableConfig::new(MIN_PLAYERS - 1).is_err());
        assert!(TableConfig::new(MAX_PLAYERS + 1).is_err());
    }
    #[test]
    fn exposes_all_seats() {
        let table = TableConfig::new(14).unwrap();
        assert_eq!(table.seat_numbers().collect::<Vec<_>>(), (0..14).collect::<Vec<_>>());
    }
    #[test]
    fn distinguishes_even_and_odd_tables_without_forcing_team_rules_yet() {
        assert!(TableConfig::new(4).unwrap().is_even_table());
        assert!(!TableConfig::new(5).unwrap().is_even_table());
        assert!(TableConfig::new(14).unwrap().is_even_table());
    }
}
