//! Sequential Guandan level progression.
//!
//! The current house rule advances the winning side one level after each
//! completed game: 2 -> 3 -> ... -> K -> A. Ace is the terminal level.

use super::Rank;

/// Advance one winning side by exactly one level.
///
/// Ace is terminal and therefore remains Ace.
pub fn next_level(level: Rank) -> Rank {
    match level {
        Rank::Two => Rank::Three,
        Rank::Three => Rank::Four,
        Rank::Four => Rank::Five,
        Rank::Five => Rank::Six,
        Rank::Six => Rank::Seven,
        Rank::Seven => Rank::Eight,
        Rank::Eight => Rank::Nine,
        Rank::Nine => Rank::Ten,
        Rank::Ten => Rank::Jack,
        Rank::Jack => Rank::Queen,
        Rank::Queen => Rank::King,
        Rank::King => Rank::Ace,
        Rank::Ace => Rank::Ace,
    }
}

pub fn is_final_level(level: Rank) -> bool {
    level == Rank::Ace
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn winner_advances_one_level_at_a_time() {
        let mut level = Rank::Two;
        let expected = [
            Rank::Three,
            Rank::Four,
            Rank::Five,
            Rank::Six,
            Rank::Seven,
            Rank::Eight,
            Rank::Nine,
            Rank::Ten,
            Rank::Jack,
            Rank::Queen,
            Rank::King,
            Rank::Ace,
        ];
        for next in expected {
            level = next_level(level);
            assert_eq!(level, next);
        }
    }

    #[test]
    fn ace_is_terminal() {
        assert!(is_final_level(Rank::Ace));
        assert_eq!(next_level(Rank::Ace), Rank::Ace);
    }
}
