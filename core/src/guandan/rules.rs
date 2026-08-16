use std::collections::BTreeMap;

use super::{CardFace, PlayPattern, Rank};

/// Classifies the first set of Guandan play patterns without wildcards.
///
/// Wild-card (heart level card) substitution, straights, consecutive pairs,
/// consecutive triples and straight flushes are deliberately layered on top
/// of this function so they can be tested independently.
pub fn classify_basic(cards: &[CardFace]) -> Option<PlayPattern> {
    match cards.len() {
        0 => None,
        1 => Some(PlayPattern::Single),
        2 => classify_two(cards),
        3 => same_rank(cards).then_some(PlayPattern::Triple),
        4 => {
            if all_jokers(cards) {
                Some(PlayPattern::JokerBomb)
            } else if same_rank(cards) {
                Some(PlayPattern::Bomb)
            } else {
                None
            }
        }
        5 => {
            if same_rank(cards) {
                Some(PlayPattern::Bomb)
            } else if is_triple_with_pair(cards) {
                Some(PlayPattern::TripleWithPair)
            } else {
                None
            }
        }
        _ if same_rank(cards) => Some(PlayPattern::Bomb),
        _ => None,
    }
}

fn classify_two(cards: &[CardFace]) -> Option<PlayPattern> {
    if same_rank(cards) {
        Some(PlayPattern::Pair)
    } else {
        None
    }
}

fn rank_of(card: CardFace) -> Option<Rank> {
    match card {
        CardFace::Suited { rank, .. } => Some(rank),
        CardFace::Joker(_) => None,
    }
}

fn same_rank(cards: &[CardFace]) -> bool {
    if cards.is_empty() {
        return false;
    }
    let first = rank_of(cards[0]);
    first.is_some() && cards.iter().all(|card| rank_of(*card) == first)
}

fn all_jokers(cards: &[CardFace]) -> bool {
    cards.iter().all(|card| matches!(card, CardFace::Joker(_)))
}

fn is_triple_with_pair(cards: &[CardFace]) -> bool {
    let mut counts = BTreeMap::new();
    for card in cards {
        let Some(rank) = rank_of(*card) else {
            return false;
        };
        *counts.entry(rank).or_insert(0usize) += 1;
    }
    let mut multiplicities = counts.values().copied().collect::<Vec<_>>();
    multiplicities.sort_unstable();
    multiplicities == [2, 3]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::guandan::{Joker, Suit};

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
    fn classifies_bombs_of_four_or_more_matching_ranks() {
        let four = [
            card(Suit::Clubs, Rank::Nine),
            card(Suit::Diamonds, Rank::Nine),
            card(Suit::Hearts, Rank::Nine),
            card(Suit::Spades, Rank::Nine),
        ];
        assert_eq!(classify_basic(&four), Some(PlayPattern::Bomb));

        let six = [
            card(Suit::Clubs, Rank::Nine),
            card(Suit::Diamonds, Rank::Nine),
            card(Suit::Hearts, Rank::Nine),
            card(Suit::Spades, Rank::Nine),
            card(Suit::Clubs, Rank::Nine),
            card(Suit::Diamonds, Rank::Nine),
        ];
        assert_eq!(classify_basic(&six), Some(PlayPattern::Bomb));
    }

    #[test]
    fn classifies_four_jokers_as_joker_bomb() {
        let cards = [
            CardFace::Joker(Joker::Small),
            CardFace::Joker(Joker::Small),
            CardFace::Joker(Joker::Big),
            CardFace::Joker(Joker::Big),
        ];
        assert_eq!(classify_basic(&cards), Some(PlayPattern::JokerBomb));
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
