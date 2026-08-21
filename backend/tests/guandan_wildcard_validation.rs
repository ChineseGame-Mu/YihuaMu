use shengji_core::guandan::{
    compare::beats_at_level, strength::strengths_at_level, CardFace, Joker, PlayPattern, Rank, Suit,
};

fn card(suit: Suit, rank: Rank) -> CardFace {
    CardFace::Suited { suit, rank }
}

fn can_beat(candidate: &[CardFace], current: &[CardFace], level: Rank) -> bool {
    let candidate_strengths = strengths_at_level(candidate, level);
    let current_strengths = strengths_at_level(current, level);
    !candidate_strengths.is_empty()
        && !current_strengths.is_empty()
        && candidate_strengths.iter().any(|candidate| {
            current_strengths
                .iter()
                .all(|current| beats_at_level(*candidate, *current, level))
        })
}

#[test]
fn heart_level_wildcard_completes_pair_and_beats_lower_pair() {
    let candidate = [
        card(Suit::Clubs, Rank::Ace),
        card(Suit::Hearts, Rank::Seven),
    ];
    let current = [
        card(Suit::Clubs, Rank::King),
        card(Suit::Diamonds, Rank::King),
    ];

    let strengths = strengths_at_level(&candidate, Rank::Seven);
    assert!(strengths.iter().any(|strength| {
        strength.pattern == PlayPattern::Pair && strength.main_rank == Rank::Ace
    }));
    assert!(can_beat(&candidate, &current, Rank::Seven));
}

#[test]
fn heart_level_wildcard_completes_straight_with_completed_high_card() {
    let candidate = [
        card(Suit::Clubs, Rank::Six),
        card(Suit::Diamonds, Rank::Seven),
        card(Suit::Spades, Rank::Eight),
        card(Suit::Clubs, Rank::Nine),
        card(Suit::Hearts, Rank::Five),
    ];
    let current = [
        card(Suit::Clubs, Rank::Five),
        card(Suit::Diamonds, Rank::Six),
        card(Suit::Spades, Rank::Seven),
        card(Suit::Clubs, Rank::Eight),
        card(Suit::Diamonds, Rank::Nine),
    ];

    let strengths = strengths_at_level(&candidate, Rank::Five);
    assert!(strengths.iter().any(|strength| {
        strength.pattern == PlayPattern::Straight && strength.main_rank == Rank::Ten
    }));
    assert!(can_beat(&candidate, &current, Rank::Five));
}

#[test]
fn heart_level_wildcard_completes_bomb_and_preserves_bomb_ordering() {
    let candidate = [
        card(Suit::Clubs, Rank::Queen),
        card(Suit::Diamonds, Rank::Queen),
        card(Suit::Spades, Rank::Queen),
        card(Suit::Hearts, Rank::Seven),
    ];
    let current = [
        card(Suit::Clubs, Rank::Jack),
        card(Suit::Diamonds, Rank::Jack),
        card(Suit::Hearts, Rank::Jack),
        card(Suit::Spades, Rank::Jack),
    ];

    let strengths = strengths_at_level(&candidate, Rank::Seven);
    assert!(strengths.iter().any(|strength| {
        strength.pattern == PlayPattern::Bomb && strength.main_rank == Rank::Queen
    }));
    assert!(can_beat(&candidate, &current, Rank::Seven));
}

#[test]
fn wildcard_cannot_substitute_for_joker_pair() {
    let invalid = [
        CardFace::Joker(Joker::Small),
        card(Suit::Hearts, Rank::Seven),
    ];
    assert!(strengths_at_level(&invalid, Rank::Seven).is_empty());
}
