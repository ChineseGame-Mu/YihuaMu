use shengji_core::guandan::{
    rules::classify_at_level,
    strength::strengths_at_level,
    CardFace, Joker, PlayPattern, Rank, Suit,
};

fn card(suit: Suit, rank: Rank) -> CardFace {
    CardFace::Suited { suit, rank }
}

fn assert_pattern(cards: &[CardFace], level: Rank, pattern: PlayPattern) {
    let patterns = classify_at_level(cards, level);
    assert!(
        patterns.contains(&pattern),
        "expected {pattern:?} for {cards:?} at level {level:?}, got {patterns:?}"
    );
}

#[test]
fn heart_level_card_is_global_wildcard_for_normal_combinations() {
    let wild = card(Suit::Hearts, Rank::Three);

    // Pair: ♥3 + 8 => 88.
    assert_pattern(
        &[wild, card(Suit::Clubs, Rank::Eight)],
        Rank::Three,
        PlayPattern::Pair,
    );

    // Triple: ♥3 + 88 => 888.
    assert_pattern(
        &[
            wild,
            card(Suit::Clubs, Rank::Eight),
            card(Suit::Diamonds, Rank::Eight),
        ],
        Rank::Three,
        PlayPattern::Triple,
    );

    // Triple with pair: ♥3 + 88 + 99 => 88899.
    assert_pattern(
        &[
            wild,
            card(Suit::Clubs, Rank::Eight),
            card(Suit::Diamonds, Rank::Eight),
            card(Suit::Clubs, Rank::Nine),
            card(Suit::Diamonds, Rank::Nine),
        ],
        Rank::Three,
        PlayPattern::TripleWithPair,
    );

    // Straight: ♥3 can supply the missing 3 in 3-4-5-6-7.
    assert_pattern(
        &[
            wild,
            card(Suit::Clubs, Rank::Four),
            card(Suit::Diamonds, Rank::Five),
            card(Suit::Spades, Rank::Six),
            card(Suit::Clubs, Rank::Seven),
        ],
        Rank::Three,
        PlayPattern::Straight,
    );

    // Consecutive pairs: ♥3 completes 10-10 in 88 99 10-10.
    assert_pattern(
        &[
            wild,
            card(Suit::Clubs, Rank::Eight),
            card(Suit::Diamonds, Rank::Eight),
            card(Suit::Clubs, Rank::Nine),
            card(Suit::Diamonds, Rank::Nine),
            card(Suit::Clubs, Rank::Ten),
        ],
        Rank::Three,
        PlayPattern::ConsecutivePairs,
    );

    // Consecutive triples / steel plate: ♥3 + 888 + 99 => 888999.
    let steel_plate = [
        wild,
        card(Suit::Diamonds, Rank::Eight),
        card(Suit::Spades, Rank::Eight),
        card(Suit::Hearts, Rank::Eight),
        card(Suit::Diamonds, Rank::Nine),
        card(Suit::Clubs, Rank::Nine),
    ];
    assert_pattern(
        &steel_plate,
        Rank::Three,
        PlayPattern::ConsecutiveTriples,
    );
    let strengths = strengths_at_level(&steel_plate, Rank::Three);
    assert!(strengths.iter().any(|strength| {
        strength.pattern == PlayPattern::ConsecutiveTriples
            && strength.main_rank == Rank::Nine
            && strength.card_count == 6
    }));

    // Bomb: ♥3 + 888 => four-card 8 bomb.
    assert_pattern(
        &[
            wild,
            card(Suit::Clubs, Rank::Eight),
            card(Suit::Diamonds, Rank::Eight),
            card(Suit::Spades, Rank::Eight),
        ],
        Rank::Three,
        PlayPattern::Bomb,
    );

    // Straight flush: ♥3 stays a suited wildcard and can supply heart 3.
    assert_pattern(
        &[
            wild,
            card(Suit::Hearts, Rank::Four),
            card(Suit::Hearts, Rank::Five),
            card(Suit::Hearts, Rank::Six),
            card(Suit::Hearts, Rank::Seven),
        ],
        Rank::Three,
        PlayPattern::StraightFlush,
    );
}

#[test]
fn heart_level_wildcard_never_substitutes_for_a_joker() {
    let wild = card(Suit::Hearts, Rank::Three);
    let patterns = classify_at_level(&[wild, CardFace::Joker(Joker::Small)], Rank::Three);
    assert!(!patterns.contains(&PlayPattern::Pair));
}

#[test]
fn non_heart_level_card_is_not_a_wildcard() {
    let club_three = card(Suit::Clubs, Rank::Three);
    let patterns = classify_at_level(
        &[club_three, card(Suit::Clubs, Rank::Eight)],
        Rank::Three,
    );
    assert!(!patterns.contains(&PlayPattern::Pair));
}
