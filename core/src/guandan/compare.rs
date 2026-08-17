//! Comparison primitives for Guandan plays.

use std::cmp::Ordering;

use super::{PlayPattern, Rank};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PlayStrength {
    pub pattern: PlayPattern,
    pub main_rank: Rank,
    pub card_count: usize,
}

impl PlayStrength {
    pub fn new(pattern: PlayPattern, main_rank: Rank, card_count: usize) -> Self {
        Self {
            pattern,
            main_rank,
            card_count,
        }
    }
}

fn is_bomb_family(pattern: PlayPattern) -> bool {
    matches!(
        pattern,
        PlayPattern::Bomb | PlayPattern::StraightFlush | PlayPattern::JokerBomb
    )
}

/// Natural Guandan rank order before level-card promotion is applied:
/// 3 < 4 < ... < K < A < 2.
fn rank_power(rank: Rank) -> u8 {
    match rank {
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
        Rank::Two => 15,
    }
}

fn compare_rank(candidate: Rank, current: Rank) -> Ordering {
    rank_power(candidate).cmp(&rank_power(current))
}

/// Guandan bomb ordering used by the multiplayer test:
/// 4-card bomb < 5-card bomb < straight flush < 6-card bomb < 7-card bomb
/// < 8-card bomb < ... < joker bomb.
///
/// Ordinary same-sized bombs are compared by their main rank.
fn bomb_tier(play: PlayStrength) -> usize {
    match play.pattern {
        PlayPattern::JokerBomb => usize::MAX,
        PlayPattern::StraightFlush => 5,
        PlayPattern::Bomb => match play.card_count {
            0..=4 => 3,
            5 => 4,
            count => count,
        },
        _ => 0,
    }
}

/// Compare a candidate against the current table play.
/// None means the two plays are not directly comparable.
pub fn compare(candidate: PlayStrength, current: PlayStrength) -> Option<Ordering> {
    let candidate_bomb = is_bomb_family(candidate.pattern);
    let current_bomb = is_bomb_family(current.pattern);

    match (candidate_bomb, current_bomb) {
        (true, false) => return Some(Ordering::Greater),
        (false, true) => return Some(Ordering::Less),
        (true, true) => {
            let tier_cmp = bomb_tier(candidate).cmp(&bomb_tier(current));
            if tier_cmp != Ordering::Equal {
                return Some(tier_cmp);
            }

            // A straight flush occupies its own tier. Two straight flushes
            // compare by their highest/main rank.
            if candidate.pattern == PlayPattern::StraightFlush
                && current.pattern == PlayPattern::StraightFlush
            {
                return Some(compare_rank(candidate.main_rank, current.main_rank));
            }

            // Joker bomb is the absolute top play. Equal joker bombs tie.
            if candidate.pattern == PlayPattern::JokerBomb
                && current.pattern == PlayPattern::JokerBomb
            {
                return Some(Ordering::Equal);
            }

            // Same-sized ordinary bombs compare by rank.
            if candidate.pattern == PlayPattern::Bomb
                && current.pattern == PlayPattern::Bomb
                && candidate.card_count == current.card_count
            {
                return Some(compare_rank(candidate.main_rank, current.main_rank));
            }

            return Some(Ordering::Equal);
        }
        (false, false) => {}
    }

    if candidate.pattern != current.pattern || candidate.card_count != current.card_count {
        return None;
    }
    Some(compare_rank(candidate.main_rank, current.main_rank))
}

pub fn beats(candidate: PlayStrength, current: PlayStrength) -> bool {
    compare(candidate, current) == Some(Ordering::Greater)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_pattern_compares_main_rank() {
        assert!(beats(
            PlayStrength::new(PlayPattern::Pair, Rank::King, 2),
            PlayStrength::new(PlayPattern::Pair, Rank::Queen, 2)
        ));
    }

    #[test]
    fn two_is_above_ace_in_natural_guandan_order() {
        assert!(beats(
            PlayStrength::new(PlayPattern::Single, Rank::Two, 1),
            PlayStrength::new(PlayPattern::Single, Rank::Ace, 1)
        ));
        assert!(!beats(
            PlayStrength::new(PlayPattern::Single, Rank::Ace, 1),
            PlayStrength::new(PlayPattern::Single, Rank::Two, 1)
        ));
    }

    #[test]
    fn unrelated_normal_patterns_are_not_comparable() {
        assert_eq!(
            compare(
                PlayStrength::new(PlayPattern::Triple, Rank::Nine, 3),
                PlayStrength::new(PlayPattern::Pair, Rank::Ace, 2)
            ),
            None
        );
    }

    #[test]
    fn bomb_beats_normal_play() {
        assert!(beats(
            PlayStrength::new(PlayPattern::Bomb, Rank::Three, 4),
            PlayStrength::new(PlayPattern::Single, Rank::Ace, 1)
        ));
    }

    #[test]
    fn larger_same_rank_bomb_beats_smaller_bomb() {
        assert!(beats(
            PlayStrength::new(PlayPattern::Bomb, Rank::Five, 6),
            PlayStrength::new(PlayPattern::Bomb, Rank::Ace, 5)
        ));
    }

    #[test]
    fn five_bomb_beats_four_bomb() {
        assert!(beats(
            PlayStrength::new(PlayPattern::Bomb, Rank::Three, 5),
            PlayStrength::new(PlayPattern::Bomb, Rank::Ace, 4)
        ));
    }

    #[test]
    fn straight_flush_sits_between_five_and_six_bombs() {
        let five = PlayStrength::new(PlayPattern::Bomb, Rank::Ace, 5);
        let flush = PlayStrength::new(PlayPattern::StraightFlush, Rank::Six, 5);
        let six = PlayStrength::new(PlayPattern::Bomb, Rank::Three, 6);
        assert!(beats(flush, five));
        assert!(beats(six, flush));
    }

    #[test]
    fn longer_bombs_keep_climbing() {
        let six = PlayStrength::new(PlayPattern::Bomb, Rank::Ace, 6);
        let seven = PlayStrength::new(PlayPattern::Bomb, Rank::Two, 7);
        let eight = PlayStrength::new(PlayPattern::Bomb, Rank::Two, 8);
        assert!(beats(seven, six));
        assert!(beats(eight, seven));
    }

    #[test]
    fn same_size_bombs_compare_rank_with_two_high() {
        assert!(beats(
            PlayStrength::new(PlayPattern::Bomb, Rank::Two, 6),
            PlayStrength::new(PlayPattern::Bomb, Rank::Ace, 6)
        ));
    }

    #[test]
    fn joker_bomb_is_absolute_top() {
        let eight = PlayStrength::new(PlayPattern::Bomb, Rank::Ace, 8);
        let joker = PlayStrength::new(PlayPattern::JokerBomb, Rank::Ace, 4);
        assert!(beats(joker, eight));
        assert!(!beats(eight, joker));
    }
}
