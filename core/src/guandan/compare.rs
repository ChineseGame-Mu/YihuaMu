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
        Self { pattern, main_rank, card_count }
    }
}

fn is_bomb_family(pattern: PlayPattern) -> bool {
    matches!(pattern, PlayPattern::Bomb | PlayPattern::StraightFlush | PlayPattern::JokerBomb)
}

fn bomb_class(pattern: PlayPattern) -> u8 {
    match pattern {
        PlayPattern::Bomb => 1,
        PlayPattern::StraightFlush => 2,
        PlayPattern::JokerBomb => 3,
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
            let class_cmp = bomb_class(candidate.pattern).cmp(&bomb_class(current.pattern));
            if class_cmp != Ordering::Equal { return Some(class_cmp); }
            if candidate.pattern == PlayPattern::Bomb {
                let count_cmp = candidate.card_count.cmp(&current.card_count);
                if count_cmp != Ordering::Equal { return Some(count_cmp); }
            }
            return Some(candidate.main_rank.cmp(&current.main_rank));
        }
        (false, false) => {}
    }

    if candidate.pattern != current.pattern || candidate.card_count != current.card_count {
        return None;
    }
    Some(candidate.main_rank.cmp(&current.main_rank))
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
    fn unrelated_normal_patterns_are_not_comparable() {
        assert_eq!(compare(
            PlayStrength::new(PlayPattern::Triple, Rank::Nine, 3),
            PlayStrength::new(PlayPattern::Pair, Rank::Ace, 2)
        ), None);
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
    fn straight_flush_beats_ordinary_bomb_and_joker_bomb_beats_it() {
        let bomb = PlayStrength::new(PlayPattern::Bomb, Rank::Ace, 4);
        let flush = PlayStrength::new(PlayPattern::StraightFlush, Rank::Six, 5);
        let joker = PlayStrength::new(PlayPattern::JokerBomb, Rank::Ace, 4);
        assert!(beats(flush, bomb));
        assert!(beats(joker, flush));
    }
}
