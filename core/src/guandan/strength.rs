//! Convert validated Guandan plays into comparable strengths.

use super::{
    compare::PlayStrength,
    level::is_level_wildcard,
    rules::{classify_at_level, classify_basic},
    CardFace, Joker, PlayPattern, Rank,
};

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

fn rank_targets() -> [Rank; 13] {
    [
        Rank::Two,
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
    ]
}

fn straight_targets() -> Vec<[Rank; 5]> {
    let ranks = rank_targets();
    let mut targets = vec![[
        Rank::Ace,
        Rank::Two,
        Rank::Three,
        Rank::Four,
        Rank::Five,
    ]];
    for start in 0..=8 {
        targets.push([
            ranks[start],
            ranks[start + 1],
            ranks[start + 2],
            ranks[start + 3],
            ranks[start + 4],
        ]);
    }
    targets
}

fn fixed_cards(cards: &[CardFace], level: Rank) -> Vec<CardFace> {
    cards
        .iter()
        .copied()
        .filter(|card| !is_level_wildcard(*card, level))
        .collect()
}

fn fixed_rank_counts(cards: &[CardFace]) -> Option<std::collections::BTreeMap<Rank, usize>> {
    let mut counts = std::collections::BTreeMap::new();
    for card in cards {
        *counts.entry(rank_of(*card)?).or_insert(0) += 1;
    }
    Some(counts)
}

fn target_fits(fixed: &[CardFace], targets: &[(Rank, usize)], wild_count: usize) -> bool {
    let Some(counts) = fixed_rank_counts(fixed) else {
        return false;
    };
    if counts
        .keys()
        .any(|rank| !targets.iter().any(|(target, _)| target == rank))
    {
        return false;
    }
    let mut missing = 0;
    for (rank, needed) in targets {
        let present = counts.get(rank).copied().unwrap_or(0);
        if present > *needed {
            return false;
        }
        missing += needed - present;
    }
    missing == wild_count
}

fn wildcard_main_ranks(cards: &[CardFace], pattern: PlayPattern, level: Rank) -> Vec<Rank> {
    let fixed = fixed_cards(cards, level);
    let wild_count = cards.len() - fixed.len();
    if wild_count == 0 {
        return Vec::new();
    }

    match pattern {
        PlayPattern::Single => vec![level],
        PlayPattern::Pair | PlayPattern::Triple | PlayPattern::Bomb => rank_targets()
            .iter()
            .copied()
            .filter(|rank| target_fits(&fixed, &[(*rank, cards.len())], wild_count))
            .collect(),
        PlayPattern::Straight | PlayPattern::StraightFlush => straight_targets()
            .into_iter()
            .filter(|target| {
                let targets = target.map(|rank| (rank, 1));
                target_fits(&fixed, &targets, wild_count)
            })
            .map(|target| {
                if target
                    == [
                        Rank::Ace,
                        Rank::Two,
                        Rank::Three,
                        Rank::Four,
                        Rank::Five,
                    ]
                {
                    Rank::Five
                } else {
                    *target.iter().max().expect("straight target is non-empty")
                }
            })
            .collect(),
        PlayPattern::TripleWithPair => rank_targets()
            .iter()
            .copied()
            .filter(|triple| {
                rank_targets().iter().copied().any(|pair| {
                    pair != *triple
                        && target_fits(&fixed, &[(*triple, 3), (pair, 2)], wild_count)
                })
            })
            .collect(),
        PlayPattern::ConsecutivePairs | PlayPattern::ConsecutiveTriples => {
            let (groups, copies) = if pattern == PlayPattern::ConsecutivePairs {
                (3, 2)
            } else {
                (2, 3)
            };
            let ranks = rank_targets();
            (0..=ranks.len() - groups)
                .filter_map(|start| {
                    let targets = (0..groups)
                        .map(|offset| (ranks[start + offset], copies))
                        .collect::<Vec<_>>();
                    target_fits(&fixed, &targets, wild_count)
                        .then_some(ranks[start + groups - 1])
                })
                .collect()
        }
        PlayPattern::JokerBomb => Vec::new(),
    }
}

/// Returns the comparison strength for a play accepted by `classify_basic`.
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

/// Return every comparable interpretation of a physical play at the active level.
/// Wild cards are expanded only into legal interpretations reported by the rules layer.
pub fn strengths_at_level(cards: &[CardFace], level: Rank) -> Vec<PlayStrength> {
    let patterns = classify_at_level(cards, level);
    if !cards.iter().any(|card| is_level_wildcard(*card, level)) {
        return strength_basic(cards).into_iter().collect();
    }

    let mut result = Vec::new();
    for pattern in patterns {
        for main_rank in wildcard_main_ranks(cards, pattern, level) {
            let strength = PlayStrength::new(pattern, main_rank, cards.len());
            if !result.contains(&strength) {
                result.push(strength);
            }
        }
    }
    result
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
    fn ace_low_straight_is_five_high() {
        let play = strength_basic(&[
            card(Suit::Clubs, Rank::Ace),
            card(Suit::Diamonds, Rank::Two),
            card(Suit::Hearts, Rank::Three),
            card(Suit::Spades, Rank::Four),
            card(Suit::Clubs, Rank::Five),
        ])
        .unwrap();
        assert_eq!(play.main_rank, Rank::Five);
    }

    #[test]
    fn wildcard_completes_pair_with_natural_rank_strength() {
        let strengths = strengths_at_level(
            &[
                card(Suit::Clubs, Rank::Ace),
                card(Suit::Hearts, Rank::Seven),
            ],
            Rank::Seven,
        );
        assert!(strengths.contains(&PlayStrength::new(PlayPattern::Pair, Rank::Ace, 2)));
    }

    #[test]
    fn wildcard_straight_uses_completed_sequence_high_card() {
        let strengths = strengths_at_level(
            &[
                card(Suit::Clubs, Rank::Six),
                card(Suit::Diamonds, Rank::Seven),
                card(Suit::Spades, Rank::Eight),
                card(Suit::Clubs, Rank::Nine),
                card(Suit::Hearts, Rank::Five),
            ],
            Rank::Five,
        );
        assert!(strengths.contains(&PlayStrength::new(
            PlayPattern::Straight,
            Rank::Ten,
            5,
        )));
    }

    #[test]
    fn wildcard_can_choose_triple_body_for_triple_with_pair() {
        let strengths = strengths_at_level(
            &[
                card(Suit::Clubs, Rank::King),
                card(Suit::Diamonds, Rank::King),
                card(Suit::Clubs, Rank::Nine),
                card(Suit::Diamonds, Rank::Nine),
                card(Suit::Hearts, Rank::Seven),
            ],
            Rank::Seven,
        );
        assert!(strengths.contains(&PlayStrength::new(
            PlayPattern::TripleWithPair,
            Rank::King,
            5,
        )));
    }

    #[test]
    fn wildcard_can_form_bomb_with_target_rank_strength() {
        let strengths = strengths_at_level(
            &[
                card(Suit::Clubs, Rank::Queen),
                card(Suit::Diamonds, Rank::Queen),
                card(Suit::Spades, Rank::Queen),
                card(Suit::Hearts, Rank::Seven),
            ],
            Rank::Seven,
        );
        assert!(strengths.contains(&PlayStrength::new(
            PlayPattern::Bomb,
            Rank::Queen,
            4,
        )));
    }
}
