//! Comparison primitives for Guandan plays.

use std::cmp::Ordering;

use super::{level::level_rank_value, PlayPattern, Rank};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PlayStrength {
    pub pattern: PlayPattern,
    pub main_rank: Rank,
    pub card_count: usize,
}

impl PlayStrength {
    pub fn new(pattern: PlayPattern, main_rank: Rank, card_count: usize) -> Self {
        Self { pattern, main_rank, card_count }
    }
}

fn is_bomb_family(pattern: PlayPattern) -> bool {
    matches!(pattern, PlayPattern::Bomb | PlayPattern::StraightFlush | PlayPattern::JokerBomb)
}

fn natural_rank_value(rank: Rank) -> u8 {
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

fn sequence_pattern(pattern: PlayPattern) -> bool {
    matches!(pattern, PlayPattern::Straight | PlayPattern::StraightFlush | PlayPattern::ConsecutivePairs | PlayPattern::ConsecutiveTriples)
}

fn compare_main_rank(candidate: PlayStrength, current: PlayStrength, level: Rank) -> Ordering {
    if sequence_pattern(candidate.pattern) || sequence_pattern(current.pattern) {
        natural_rank_value(candidate.main_rank).cmp(&natural_rank_value(current.main_rank))
    } else {
        level_rank_value(candidate.main_rank, level).cmp(&level_rank_value(current.main_rank, level))
    }
}

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

pub fn compare_at_level(candidate: PlayStrength, current: PlayStrength, level: Rank) -> Option<Ordering> {
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
            if candidate.pattern == PlayPattern::StraightFlush && current.pattern == PlayPattern::StraightFlush {
                return Some(compare_main_rank(candidate, current, level));
            }
            if candidate.pattern == PlayPattern::JokerBomb && current.pattern == PlayPattern::JokerBomb {
                return Some(Ordering::Equal);
            }
            if candidate.pattern == PlayPattern::Bomb
                && current.pattern == PlayPattern::Bomb
                && candidate.card_count == current.card_count
            {
                return Some(compare_main_rank(candidate, current, level));
            }
            return Some(Ordering::Equal);
        }
        (false, false) => {}
    }

    if candidate.pattern != current.pattern || candidate.card_count != current.card_count {
        return None;
    }
    Some(compare_main_rank(candidate, current, level))
}

pub fn beats_at_level(candidate: PlayStrength, current: PlayStrength, level: Rank) -> bool {
    compare_at_level(candidate, current, level) == Some(Ordering::Greater)
}

pub fn compare(candidate: PlayStrength, current: PlayStrength) -> Option<Ordering> {
    compare_at_level(candidate, current, Rank::Two)
}

pub fn beats(candidate: PlayStrength, current: PlayStrength) -> bool {
    compare(candidate, current) == Some(Ordering::Greater)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn level_rank_beats_ace() {
        let five = PlayStrength::new(PlayPattern::Single, Rank::Five, 1);
        let ace = PlayStrength::new(PlayPattern::Single, Rank::Ace, 1);
        assert!(beats_at_level(five, ace, Rank::Five));
        assert!(!beats_at_level(ace, five, Rank::Five));
    }

    #[test]
    fn level_rank_controls_pairs_and_equal_size_bombs() {
        assert!(beats_at_level(
            PlayStrength::new(PlayPattern::Pair, Rank::Nine, 2),
            PlayStrength::new(PlayPattern::Pair, Rank::Ace, 2),
            Rank::Nine,
        ));
        assert!(beats_at_level(
            PlayStrength::new(PlayPattern::Bomb, Rank::Nine, 4),
            PlayStrength::new(PlayPattern::Bomb, Rank::Ace, 4),
            Rank::Nine,
        ));
    }

    #[test]
    fn sequence_high_card_keeps_natural_order() {
        assert!(beats_at_level(
            PlayStrength::new(PlayPattern::Straight, Rank::King, 5),
            PlayStrength::new(PlayPattern::Straight, Rank::Nine, 5),
            Rank::Nine,
        ));
    }

    #[test]
    fn bomb_beats_normal_play() {
        assert!(beats_at_level(
            PlayStrength::new(PlayPattern::Bomb, Rank::Three, 4),
            PlayStrength::new(PlayPattern::Single, Rank::Ace, 1),
            Rank::Five,
        ));
    }

    #[test]
    fn straight_flush_sits_between_five_and_six_bombs() {
        let five = PlayStrength::new(PlayPattern::Bomb, Rank::Ace, 5);
        let flush = PlayStrength::new(PlayPattern::StraightFlush, Rank::Six, 5);
        let six = PlayStrength::new(PlayPattern::Bomb, Rank::Three, 6);
        assert!(beats_at_level(flush, five, Rank::Two));
        assert!(beats_at_level(six, flush, Rank::Two));
    }

    #[test]
    fn joker_bomb_is_absolute_top() {
        let eight = PlayStrength::new(PlayPattern::Bomb, Rank::Ace, 8);
        let joker = PlayStrength::new(PlayPattern::JokerBomb, Rank::Ace, 4);
        assert!(beats_at_level(joker, eight, Rank::Five));
        assert!(!beats_at_level(eight, joker, Rank::Five));
    }
}
