//! Sequential Guandan level progression and level-aware rank ordering.
//!
//! The current house rule advances the winning side one level after each
//! completed game: 2 -> 3 -> ... -> K -> A. Ace is the terminal level.
//!
//! In each game, the active level rank is the strongest non-joker rank. Only
//! the small and big jokers rank above it.

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

/// Base ordering for non-level, non-joker cards in Guandan.
///
/// Two is the lowest ordinary rank. Ace is the highest ordinary rank until a
/// level rank is promoted above it.
fn ordinary_rank_value(rank: Rank) -> u8 {
    match rank {
        Rank::Two => 2,
        Rank::Three => 3,
        Rank::Four => 4,
        Rank::Five => 5,
        Rank::Six => 6,
        Rank::Seven => 7,
        Rank::Eight => 8,
        Rank::Nine => 9,
        Rank::Ten => 10,
        Rank::Jack => 11,
        Rank::Queen => 12,
        Rank::King => 13,
        Rank::Ace => 14,
    }
}

/// Level-aware strength for a suited rank.
///
/// The active level is always the strongest non-joker rank. Jokers are handled
/// separately by the card-strength layer and therefore intentionally do not
/// appear in this function.
pub fn level_rank_value(rank: Rank, level: Rank) -> u8 {
    if rank == level {
        15
    } else {
        ordinary_rank_value(rank)
    }
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

    #[test]
    fn current_level_is_highest_non_joker_rank() {
        assert!(level_rank_value(Rank::Five, Rank::Five) > level_rank_value(Rank::Ace, Rank::Five));
        assert!(level_rank_value(Rank::Nine, Rank::Nine) > level_rank_value(Rank::Ace, Rank::Nine));
        assert!(level_rank_value(Rank::Two, Rank::Two) > level_rank_value(Rank::Ace, Rank::Two));
    }

    #[test]
    fn two_is_low_when_it_is_not_the_level() {
        assert!(
            level_rank_value(Rank::Three, Rank::Five) > level_rank_value(Rank::Two, Rank::Five)
        );
        assert!(level_rank_value(Rank::Ace, Rank::Five) > level_rank_value(Rank::Two, Rank::Five));
    }
}
