//! Convert a validated basic Guandan play into a comparable strength.
//! Wild-card substitution and level-rank promotion are intentionally handled later.

use super::{
    compare::PlayStrength,
    rules::classify_basic,
    CardFace, PlayPattern, Rank,
};

fn rank_of(card: CardFace) -> Option<Rank> {
    match card {
        CardFace::Suited { rank, .. } => Some(rank),
        CardFace::Joker(_) => None,
    }
}

fn highest_rank(cards: &[CardFace]) -> Option<Rank> {
    cards.iter().filter_map(|card| rank_of(*card)).max()
}

fn triple_rank(cards: &[CardFace]) -> Option<Rank> {
    let mut ranks = cards.iter().filter_map(|card| rank_of(*card)).collect::<Vec<_>>();
    ranks.sort_unstable();
    ranks.into_iter().find(|rank| {
        cards.iter().filter(|card| rank_of(**card) == Some(*rank)).count() == 3
    })
}

/// Returns the comparison strength for a play accepted by `classify_basic`.
/// Joker bomb uses Ace as a harmless placeholder rank because joker bombs compare
/// by their absolute bomb tier rather than rank.
pub fn strength_basic(cards: &[CardFace]) -> Option<PlayStrength> {
    let pattern = classify_basic(cards)?;
    let main_rank = match pattern {
        PlayPattern::JokerBomb => Rank::Ace,
        PlayPattern::TripleWithPair => triple_rank(cards)?,
        PlayPattern::Straight
        | PlayPattern::StraightFlush
        | PlayPattern::ConsecutivePairs
        | PlayPattern::ConsecutiveTriples => highest_rank(cards)?,
        PlayPattern::Single
        | PlayPattern::Pair
        | PlayPattern::Triple
        | PlayPattern::Bomb => rank_of(*cards.first()?)?,
    };
    Some(PlayStrength::new(pattern, main_rank, cards.len()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::guandan::{Joker, Suit};

    fn card(suit: Suit, rank: Rank) -> CardFace {
        CardFace::Suited { suit, rank }
    }

    #[test]
    fn uses_pair_rank_as_main_rank() {
        let play = strength_basic(&[
            card(Suit::Clubs, Rank::King),
            card(Suit::Hearts, Rank::King),
        ])
        .unwrap();
        assert_eq!(play.pattern, PlayPattern::Pair);
        assert_eq!(play.main_rank, Rank::King);
    }

    #[test]
    fn uses_triple_rank_for_triple_with_pair() {
        let play = strength_basic(&[
            card(Suit::Clubs, Rank::Ten),
            card(Suit::Diamonds, Rank::Ten),
            card(Suit::Hearts, Rank::Ten),
            card(Suit::Clubs, Rank::Ace),
            card(Suit::Diamonds, Rank::Ace),
        ])
        .unwrap();
        assert_eq!(play.main_rank, Rank::Ten);
    }

    #[test]
    fn uses_high_card_for_sequences() {
        let play = strength_basic(&[
            card(Suit::Clubs, Rank::Three),
            card(Suit::Diamonds, Rank::Four),
            card(Suit::Hearts, Rank::Five),
            card(Suit::Spades, Rank::Six),
            card(Suit::Clubs, Rank::Seven),
        ])
        .unwrap();
        assert_eq!(play.main_rank, Rank::Seven);
    }

    #[test]
    fn joker_bomb_gets_comparable_strength() {
        let play = strength_basic(&[
            CardFace::Joker(Joker::Small),
            CardFace::Joker(Joker::Small),
            CardFace::Joker(Joker::Big),
            CardFace::Joker(Joker::Big),
        ])
        .unwrap();
        assert_eq!(play.pattern, PlayPattern::JokerBomb);
    }
}