use std::collections::BTreeMap;

use super::{CardFace, PlayPattern, Rank, Suit};

/// Classify a Guandan play without wild-card substitution.
/// Heart-level wild cards are intentionally handled in a later layer.
pub fn classify_basic(cards: &[CardFace]) -> Option<PlayPattern> {
    match cards.len() {
        0 => None,
        1 => Some(PlayPattern::Single),
        2 => same_face_rank(cards).then_some(PlayPattern::Pair),
        3 => same_face_rank(cards).then_some(PlayPattern::Triple),
        4 => {
            if all_jokers(cards) {
                Some(PlayPattern::JokerBomb)
            } else if same_face_rank(cards) {
                Some(PlayPattern::Bomb)
            } else {
                None
            }
        }
        5 => {
            if same_face_rank(cards) {
                Some(PlayPattern::Bomb)
            } else if is_straight_flush(cards) {
                Some(PlayPattern::StraightFlush)
            } else if is_straight(cards) {
                Some(PlayPattern::Straight)
            } else if is_triple_with_pair(cards) {
                Some(PlayPattern::TripleWithPair)
            } else {
                None
            }
        }
        6 => {
            if same_face_rank(cards) {
                Some(PlayPattern::Bomb)
            } else if is_consecutive_pairs(cards) {
                Some(PlayPattern::ConsecutivePairs)
            } else if is_consecutive_triples(cards) {
                Some(PlayPattern::ConsecutiveTriples)
            } else {
                None
            }
        }
        _ if same_face_rank(cards) => Some(PlayPattern::Bomb),
        _ => None,
    }
}

fn rank_of(card: CardFace) -> Option<Rank> {
    match card {
        CardFace::Suited { rank, .. } => Some(rank),
        CardFace::Joker(_) => None,
    }
}

fn suit_of(card: CardFace) -> Option<Suit> {
    match card {
        CardFace::Suited { suit, .. } => Some(suit),
        CardFace::Joker(_) => None,
    }
}

/// Same suited rank or the same joker face. This allows two small jokers or two
/// big jokers from the duplicated deck to form a legal pair.
fn same_face_rank(cards: &[CardFace]) -> bool {
    let Some(first) = cards.first().copied() else {
        return false;
    };
    match first {
        CardFace::Suited { rank, .. } => cards.iter().all(|card| {
            matches!(card, CardFace::Suited { rank: other, .. } if *other == rank)
        }),
        CardFace::Joker(joker) => cards
            .iter()
            .all(|card| matches!(card, CardFace::Joker(other) if *other == joker)),
    }
}

fn all_jokers(cards: &[CardFace]) -> bool {
    cards.iter().all(|card| matches!(card, CardFace::Joker(_)))
}

fn rank_counts(cards: &[CardFace]) -> Option<BTreeMap<Rank, usize>> {
    let mut counts = BTreeMap::new();
    for card in cards {
        let rank = rank_of(*card)?;
        *counts.entry(rank).or_insert(0usize) += 1;
    }
    Some(counts)
}

fn rank_value(rank: Rank) -> u8 {
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

fn consecutive(ranks: &[Rank]) -> bool {
    if ranks.is_empty() {
        return false;
    }
    let mut values = ranks.iter().map(|rank| rank_value(*rank)).collect::<Vec<_>>();
    values.sort_unstable();
    values.dedup();
    if values.len() != ranks.len() {
        return false;
    }
    values.windows(2).all(|window| window[1] == window[0] + 1)
}

fn is_triple_with_pair(cards: &[CardFace]) -> bool {
    let Some(counts) = rank_counts(cards) else {
        return false;
    };
    let mut multiplicities = counts.values().copied().collect::<Vec<_>>();
    multiplicities.sort_unstable();
    multiplicities == [2, 3]
}

fn is_straight(cards: &[CardFace]) -> bool {
    if cards.len() != 5 {
        return false;
    }
    let Some(counts) = rank_counts(cards) else {
        return false;
    };
    counts.values().all(|count| *count == 1)
        && consecutive(&counts.keys().copied().collect::<Vec<_>>())
}

fn is_straight_flush(cards: &[CardFace]) -> bool {
    if !is_straight(cards) {
        return false;
    }
    let Some(first) = suit_of(cards[0]) else {
        return false;
    };
    cards.iter().all(|card| suit_of(*card) == Some(first))
}

fn is_consecutive_pairs(cards: &[CardFace]) -> bool {
    if cards.len() != 6 {
        return false;
    }
    let Some(counts) = rank_counts(cards) else {
        return false;
    };
    counts.len() == 3
        && counts.values().all(|count| *count == 2)
        && consecutive(&counts.keys().copied().collect::<Vec<_>>())
}

fn is_consecutive_triples(cards: &[CardFace]) -> bool {
    if cards.len() != 6 {
        return false;
    }
    let Some(counts) = rank_counts(cards) else {
        return false;
    };
    counts.len() == 2
        && counts.values().all(|count| *count == 3)
        && consecutive(&counts.keys().copied().collect::<Vec<_>>())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::guandan::Joker;

    fn card(suit: Suit, rank: Rank) -> CardFace {
        CardFace::Suited { suit, rank }
    }

    #[test]
    fn classifies_single_pair_and_triple() {
        assert_eq!(
            classify_basic(&[card(Suit::Clubs, Rank::Ace)]),
            Some(PlayPattern::Single)
        );
        assert_eq!(
            classify_basic(&[
                card(Suit::Clubs, Rank::Ace),
                card(Suit::Hearts, Rank::Ace),
            ]),
            Some(PlayPattern::Pair)
        );
        assert_eq!(
            classify_basic(&[
                card(Suit::Clubs, Rank::King),
                card(Suit::Hearts, Rank::King),
                card(Suit::Spades, Rank::King),
            ]),
            Some(PlayPattern::Triple)
        );
    }

    #[test]
    fn classifies_same_joker_pairs() {
        assert_eq!(
            classify_basic(&[
                CardFace::Joker(Joker::Small),
                CardFace::Joker(Joker::Small),
            ]),
            Some(PlayPattern::Pair)
        );
        assert_eq!(
            classify_basic(&[
                CardFace::Joker(Joker::Big),
                CardFace::Joker(Joker::Big),
            ]),
            Some(PlayPattern::Pair)
        );
        assert_eq!(
            classify_basic(&[
                CardFace::Joker(Joker::Small),
                CardFace::Joker(Joker::Big),
            ]),
            None
        );
    }

    #[test]
    fn classifies_bombs_and_joker_bomb() {
        let four = [
            card(Suit::Clubs, Rank::Nine),
            card(Suit::Diamonds, Rank::Nine),
            card(Suit::Hearts, Rank::Nine),
            card(Suit::Spades, Rank::Nine),
        ];
        assert_eq!(classify_basic(&four), Some(PlayPattern::Bomb));
        let jokers = [
            CardFace::Joker(Joker::Small),
            CardFace::Joker(Joker::Small),
            CardFace::Joker(Joker::Big),
            CardFace::Joker(Joker::Big),
        ];
        assert_eq!(classify_basic(&jokers), Some(PlayPattern::JokerBomb));
    }

    #[test]
    fn classifies_triple_with_pair() {
        let cards = [
            card(Suit::Clubs, Rank::Ten),
            card(Suit::Diamonds, Rank::Ten),
            card(Suit::Hearts, Rank::Ten),
            card(Suit::Clubs, Rank::Queen),
            card(Suit::Diamonds, Rank::Queen),
        ];
        assert_eq!(classify_basic(&cards), Some(PlayPattern::TripleWithPair));
    }

    #[test]
    fn classifies_straight_and_straight_flush() {
        let straight = [
            card(Suit::Clubs, Rank::Three),
            card(Suit::Diamonds, Rank::Four),
            card(Suit::Hearts, Rank::Five),
            card(Suit::Spades, Rank::Six),
            card(Suit::Clubs, Rank::Seven),
        ];
        assert_eq!(classify_basic(&straight), Some(PlayPattern::Straight));
        let flush = [
            card(Suit::Hearts, Rank::Nine),
            card(Suit::Hearts, Rank::Ten),
            card(Suit::Hearts, Rank::Jack),
            card(Suit::Hearts, Rank::Queen),
            card(Suit::Hearts, Rank::King),
        ];
        assert_eq!(classify_basic(&flush), Some(PlayPattern::StraightFlush));
    }

    #[test]
    fn classifies_consecutive_pairs_and_triples() {
        let pairs = [
            card(Suit::Clubs, Rank::Five),
            card(Suit::Hearts, Rank::Five),
            card(Suit::Clubs, Rank::Six),
            card(Suit::Hearts, Rank::Six),
            card(Suit::Clubs, Rank::Seven),
            card(Suit::Hearts, Rank::Seven),
        ];
        assert_eq!(classify_basic(&pairs), Some(PlayPattern::ConsecutivePairs));
        let triples = [
            card(Suit::Clubs, Rank::Eight),
            card(Suit::Hearts, Rank::Eight),
            card(Suit::Spades, Rank::Eight),
            card(Suit::Clubs, Rank::Nine),
            card(Suit::Hearts, Rank::Nine),
            card(Suit::Spades, Rank::Nine),
        ];
        assert_eq!(
            classify_basic(&triples),
            Some(PlayPattern::ConsecutiveTriples)
        );
    }

    #[test]
    fn rejects_mismatched_basic_plays() {
        assert_eq!(
            classify_basic(&[
                card(Suit::Clubs, Rank::Three),
                card(Suit::Clubs, Rank::Four),
            ]),
            None
        );
    }
}
