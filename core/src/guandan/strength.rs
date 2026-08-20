//! Convert a validated basic Guandan play into a comparable strength.
//! Wild-card substitution is intentionally handled later.

use super::{compare::PlayStrength, rules::classify_basic, CardFace, Joker, PlayPattern, Rank};

fn rank_of(card: CardFace) -> Option<Rank> {
    match card {
        CardFace::Suited { rank, .. } => Some(rank),
        CardFace::Joker(_) => None,
    }
}

fn joker_of(card: CardFace) -> Option<Joker> {
    match card {
        CardFace::Joker(joker) => Some(joker),
        CardFace::Suited { .. } => None,
    }
}

fn highest_rank(cards: &[CardFace]) -> Option<Rank> {
    cards.iter().filter_map(|card| rank_of(*card)).max()
}

fn is_ace_low_straight(cards: &[CardFace]) -> bool {
    if cards.len() != 5 {
        return false;
    }
    let mut ranks = cards
        .iter()
        .filter_map(|card| rank_of(*card))
        .collect::<Vec<_>>();
    ranks.sort_unstable();
    ranks.dedup();
    ranks == [Rank::Two, Rank::Three, Rank::Four, Rank::Five, Rank::Ace]
}

fn sequence_high_rank(cards: &[CardFace], pattern: PlayPattern) -> Option<Rank> {
    if matches!(pattern, PlayPattern::Straight | PlayPattern::StraightFlush)
        && is_ace_low_straight(cards)
    {
        Some(Rank::Five)
    } else {
        highest_rank(cards)
    }
}

fn triple_rank(cards: &[CardFace]) -> Option<Rank> {
    let mut ranks = cards
        .iter()
        .filter_map(|card| rank_of(*card))
        .collect::<Vec<_>>();
    ranks.sort_unstable();
    ranks.into_iter().find(|rank| {
        cards
            .iter()
            .filter(|card| rank_of(**card) == Some(*rank))
            .count()
            == 3
    })
}

/// Returns the comparison strength for a play accepted by `classify_basic`.
/// Joker bomb uses Ace as a harmless placeholder rank because joker bombs compare
/// by their absolute bomb tier rather than rank.
pub fn strength_basic(cards: &[CardFace]) -> Option<PlayStrength> {
    let pattern = classify_basic(cards)?;

    if matches!(
        pattern,
        PlayPattern::Single | PlayPattern::Pair | PlayPattern::Triple
    ) {
        if let Some(joker) = joker_of(*cards.first()?) {
            return Some(PlayStrength::with_joker(pattern, joker, cards.len()));
        }
    }

    let main_rank = match pattern {
        PlayPattern::JokerBomb => Rank::Ace,
        PlayPattern::TripleWithPair => triple_rank(cards)?,
        PlayPattern::Straight
        | PlayPattern::StraightFlush
        | PlayPattern::ConsecutivePairs
        | PlayPattern::ConsecutiveTriples => sequence_high_rank(cards, pattern)?,
        PlayPattern::Single | PlayPattern::Pair | PlayPattern::Triple | PlayPattern::Bomb => {
            rank_of(*cards.first()?)?
        }
    };
    Some(PlayStrength::new(pattern, main_rank, cards.len()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::guandan::Suit;

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
        assert_eq!(play.joker, None);
    }

    #[test]
    fn supports_single_jokers() {
        let small = strength_basic(&[CardFace::Joker(Joker::Small)]).unwrap();
        let big = strength_basic(&[CardFace::Joker(Joker::Big)]).unwrap();
        assert_eq!(small.pattern, PlayPattern::Single);
        assert_eq!(small.joker, Some(Joker::Small));
        assert_eq!(big.joker, Some(Joker::Big));
    }

    #[test]
    fn supports_same_joker_pairs() {
        let play = strength_basic(&[CardFace::Joker(Joker::Small), CardFace::Joker(Joker::Small)])
            .unwrap();
        assert_eq!(play.pattern, PlayPattern::Pair);
        assert_eq!(play.joker, Some(Joker::Small));
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
    fn ace_low_straight_is_five_high() {
        let play = strength_basic(&[
            card(Suit::Clubs, Rank::Ace),
            card(Suit::Diamonds, Rank::Two),
            card(Suit::Hearts, Rank::Three),
            card(Suit::Spades, Rank::Four),
            card(Suit::Clubs, Rank::Five),
        ])
        .unwrap();
        assert_eq!(play.pattern, PlayPattern::Straight);
        assert_eq!(play.main_rank, Rank::Five);
    }

    #[test]
    fn ace_low_straight_flush_is_five_high() {
        let play = strength_basic(&[
            card(Suit::Hearts, Rank::Ace),
            card(Suit::Hearts, Rank::Two),
            card(Suit::Hearts, Rank::Three),
            card(Suit::Hearts, Rank::Four),
            card(Suit::Hearts, Rank::Five),
        ])
        .unwrap();
        assert_eq!(play.pattern, PlayPattern::StraightFlush);
        assert_eq!(play.main_rank, Rank::Five);
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
