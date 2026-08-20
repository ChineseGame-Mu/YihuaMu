use std::collections::BTreeMap;

use super::{level::is_level_wildcard, CardFace, PlayPattern, Rank, Suit};

/// Classify a Guandan play without wild-card substitution.
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

/// Return every legal basic pattern obtainable by substituting the active
/// heart-level card as any suited non-joker card. Returning all interpretations
/// is important because the same physical cards can legitimately represent
/// more than one pattern; the comparison layer can then choose the interpretation
/// that actually beats the table play.
pub fn classify_at_level(cards: &[CardFace], level: Rank) -> Vec<PlayPattern> {
    if cards.is_empty() {
        return Vec::new();
    }

    let wild_count = cards
        .iter()
        .filter(|card| is_level_wildcard(**card, level))
        .count();
    if wild_count == 0 {
        return classify_basic(cards).into_iter().collect();
    }

    let fixed = cards
        .iter()
        .copied()
        .filter(|card| !is_level_wildcard(*card, level))
        .collect::<Vec<_>>();
    let mut result = Vec::new();

    let mut add = |pattern: PlayPattern, legal: bool| {
        if legal && !result.contains(&pattern) {
            result.push(pattern);
        }
    };

    match cards.len() {
        1 => add(PlayPattern::Single, true),
        2 => add(
            PlayPattern::Pair,
            can_fill_same_rank(&fixed, wild_count, 2),
        ),
        3 => add(
            PlayPattern::Triple,
            can_fill_same_rank(&fixed, wild_count, 3),
        ),
        4 => add(
            PlayPattern::Bomb,
            can_fill_same_rank(&fixed, wild_count, 4),
        ),
        5 => {
            add(
                PlayPattern::Bomb,
                can_fill_same_rank(&fixed, wild_count, 5),
            );
            add(
                PlayPattern::StraightFlush,
                can_fill_straight(&fixed, wild_count, true),
            );
            add(
                PlayPattern::Straight,
                can_fill_straight(&fixed, wild_count, false),
            );
            add(
                PlayPattern::TripleWithPair,
                can_fill_triple_with_pair(&fixed, wild_count),
            );
        }
        6 => {
            add(
                PlayPattern::Bomb,
                can_fill_same_rank(&fixed, wild_count, 6),
            );
            add(
                PlayPattern::ConsecutivePairs,
                can_fill_consecutive_groups(&fixed, wild_count, 3, 2),
            );
            add(
                PlayPattern::ConsecutiveTriples,
                can_fill_consecutive_groups(&fixed, wild_count, 2, 3),
            );
        }
        count => add(
            PlayPattern::Bomb,
            can_fill_same_rank(&fixed, wild_count, count),
        ),
    }

    result
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
        CardFace::Suited { rank, .. } => cards
            .iter()
            .all(|card| matches!(card, CardFace::Suited { rank: other, .. } if *other == rank)),
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

fn ranks_in_order() -> [Rank; 13] {
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
    let ranks = ranks_in_order();
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

fn can_fill_same_rank(fixed: &[CardFace], wild_count: usize, total: usize) -> bool {
    if fixed.len() + wild_count != total {
        return false;
    }
    let Some(counts) = rank_counts(fixed) else {
        return false;
    };
    counts.len() <= 1
}

fn can_fill_targets(
    fixed: &[CardFace],
    wild_count: usize,
    targets: &[(Rank, usize)],
) -> bool {
    let Some(counts) = rank_counts(fixed) else {
        return false;
    };
    let mut missing = 0usize;
    for (rank, needed) in targets {
        let present = counts.get(rank).copied().unwrap_or(0);
        if present > *needed {
            return false;
        }
        missing += needed - present;
    }
    if counts
        .keys()
        .any(|rank| !targets.iter().any(|(target, _)| target == rank))
    {
        return false;
    }
    missing == wild_count
}

fn can_fill_straight(fixed: &[CardFace], wild_count: usize, same_suit: bool) -> bool {
    if fixed.len() + wild_count != 5 {
        return false;
    }
    if same_suit && !fixed.is_empty() {
        let Some(suit) = suit_of(fixed[0]) else {
            return false;
        };
        if fixed.iter().any(|card| suit_of(*card) != Some(suit)) {
            return false;
        }
    }
    straight_targets().iter().any(|target| {
        let targets = target.map(|rank| (rank, 1));
        can_fill_targets(fixed, wild_count, &targets)
    })
}

fn can_fill_triple_with_pair(fixed: &[CardFace], wild_count: usize) -> bool {
    if fixed.len() + wild_count != 5 {
        return false;
    }
    let ranks = ranks_in_order();
    ranks.iter().copied().any(|triple| {
        ranks.iter().copied().any(|pair| {
            triple != pair
                && can_fill_targets(fixed, wild_count, &[(triple, 3), (pair, 2)])
        })
    })
}

fn can_fill_consecutive_groups(
    fixed: &[CardFace],
    wild_count: usize,
    group_count: usize,
    copies_per_rank: usize,
) -> bool {
    if fixed.len() + wild_count != group_count * copies_per_rank {
        return false;
    }
    let ranks = ranks_in_order();
    (0..=ranks.len() - group_count).any(|start| {
        let targets = (0..group_count)
            .map(|offset| (ranks[start + offset], copies_per_rank))
            .collect::<Vec<_>>();
        can_fill_targets(fixed, wild_count, &targets)
    })
}

fn consecutive(ranks: &[Rank]) -> bool {
    if ranks.is_empty() {
        return false;
    }
    let mut values = ranks
        .iter()
        .map(|rank| rank_value(*rank))
        .collect::<Vec<_>>();
    values.sort_unstable();
    values.dedup();
    if values.len() != ranks.len() {
        return false;
    }
    values.windows(2).all(|window| window[1] == window[0] + 1)
}

fn ace_low_straight(ranks: &[Rank]) -> bool {
    if ranks.len() != 5 {
        return false;
    }
    let mut values = ranks
        .iter()
        .map(|rank| rank_value(*rank))
        .collect::<Vec<_>>();
    values.sort_unstable();
    values.dedup();
    values == [2, 3, 4, 5, 14]
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
    let ranks = counts.keys().copied().collect::<Vec<_>>();
    counts.values().all(|count| *count == 1)
        && (consecutive(&ranks) || ace_low_straight(&ranks))
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
            classify_basic(&[card(Suit::Clubs, Rank::Ace), card(Suit::Hearts, Rank::Ace),]),
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
            classify_basic(&[CardFace::Joker(Joker::Small), CardFace::Joker(Joker::Small),]),
            Some(PlayPattern::Pair)
        );
        assert_eq!(
            classify_basic(&[CardFace::Joker(Joker::Big), CardFace::Joker(Joker::Big),]),
            Some(PlayPattern::Pair)
        );
        assert_eq!(
            classify_basic(&[CardFace::Joker(Joker::Small), CardFace::Joker(Joker::Big),]),
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
    fn classifies_ace_low_straights_and_rejects_wraparound() {
        let straight = [
            card(Suit::Clubs, Rank::Ace),
            card(Suit::Diamonds, Rank::Two),
            card(Suit::Hearts, Rank::Three),
            card(Suit::Spades, Rank::Four),
            card(Suit::Clubs, Rank::Five),
        ];
        assert_eq!(classify_basic(&straight), Some(PlayPattern::Straight));

        let flush = [
            card(Suit::Hearts, Rank::Ace),
            card(Suit::Hearts, Rank::Two),
            card(Suit::Hearts, Rank::Three),
            card(Suit::Hearts, Rank::Four),
            card(Suit::Hearts, Rank::Five),
        ];
        assert_eq!(classify_basic(&flush), Some(PlayPattern::StraightFlush));

        let wraparound = [
            card(Suit::Clubs, Rank::Jack),
            card(Suit::Diamonds, Rank::Queen),
            card(Suit::Hearts, Rank::King),
            card(Suit::Spades, Rank::Ace),
            card(Suit::Clubs, Rank::Two),
        ];
        assert_eq!(classify_basic(&wraparound), None);
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

    #[test]
    fn heart_level_wildcard_completes_pair_and_bomb() {
        let wild = card(Suit::Hearts, Rank::Seven);
        assert!(classify_at_level(&[card(Suit::Clubs, Rank::King), wild], Rank::Seven)
            .contains(&PlayPattern::Pair));
        assert!(classify_at_level(
            &[
                card(Suit::Clubs, Rank::King),
                card(Suit::Diamonds, Rank::King),
                card(Suit::Spades, Rank::King),
                wild,
            ],
            Rank::Seven,
        )
        .contains(&PlayPattern::Bomb));
    }

    #[test]
    fn heart_level_wildcard_completes_straight_and_straight_flush() {
        let wild = card(Suit::Hearts, Rank::Nine);
        let straight = [
            card(Suit::Clubs, Rank::Five),
            card(Suit::Diamonds, Rank::Six),
            card(Suit::Hearts, Rank::Seven),
            card(Suit::Spades, Rank::Eight),
            wild,
        ];
        assert!(classify_at_level(&straight, Rank::Nine).contains(&PlayPattern::Straight));

        let flush = [
            card(Suit::Spades, Rank::Five),
            card(Suit::Spades, Rank::Six),
            card(Suit::Spades, Rank::Seven),
            card(Suit::Spades, Rank::Eight),
            wild,
        ];
        assert!(classify_at_level(&flush, Rank::Nine).contains(&PlayPattern::StraightFlush));
    }

    #[test]
    fn non_heart_level_card_is_not_wild() {
        let cards = [
            card(Suit::Clubs, Rank::King),
            card(Suit::Spades, Rank::Seven),
        ];
        assert!(!classify_at_level(&cards, Rank::Seven).contains(&PlayPattern::Pair));
    }

    #[test]
    fn wildcard_never_substitutes_for_a_joker() {
        let cards = [
            CardFace::Joker(Joker::Small),
            card(Suit::Hearts, Rank::Seven),
        ];
        assert!(classify_at_level(&cards, Rank::Seven).is_empty());
    }
}
