use shengji_core::guandan::{
    compare::beats_at_level,
    strength::strength_basic,
    CardFace, PlayPattern, Rank, Suit,
};

fn card(suit: Suit, rank: Rank) -> CardFace {
    CardFace::Suited { suit, rank }
}

fn straight_flush(suit: Suit, ranks: [Rank; 5]) -> Vec<CardFace> {
    ranks.into_iter().map(|rank| card(suit, rank)).collect()
}

#[test]
fn ace_low_straight_flush_is_five_high() {
    let ace_low = straight_flush(
        Suit::Hearts,
        [Rank::Ace, Rank::Two, Rank::Three, Rank::Four, Rank::Five],
    );
    let six_high = straight_flush(
        Suit::Spades,
        [Rank::Two, Rank::Three, Rank::Four, Rank::Five, Rank::Six],
    );

    let ace_low_strength = strength_basic(&ace_low).unwrap();
    let six_high_strength = strength_basic(&six_high).unwrap();

    assert_eq!(ace_low_strength.pattern, PlayPattern::StraightFlush);
    assert_eq!(ace_low_strength.main_rank, Rank::Five);
    assert!(beats_at_level(
        six_high_strength,
        ace_low_strength,
        Rank::Two,
    ));
    assert!(!beats_at_level(
        ace_low_strength,
        six_high_strength,
        Rank::Two,
    ));
}

#[test]
fn ten_to_ace_is_the_highest_straight_flush() {
    let king_high = straight_flush(
        Suit::Clubs,
        [Rank::Nine, Rank::Ten, Rank::Jack, Rank::Queen, Rank::King],
    );
    let ace_high = straight_flush(
        Suit::Diamonds,
        [Rank::Ten, Rank::Jack, Rank::Queen, Rank::King, Rank::Ace],
    );

    assert!(beats_at_level(
        strength_basic(&ace_high).unwrap(),
        strength_basic(&king_high).unwrap(),
        Rank::Seven,
    ));
    assert!(!beats_at_level(
        strength_basic(&king_high).unwrap(),
        strength_basic(&ace_high).unwrap(),
        Rank::Seven,
    ));
}

#[test]
fn equal_rank_straight_flushes_do_not_compare_by_suit() {
    let hearts = straight_flush(
        Suit::Hearts,
        [Rank::Six, Rank::Seven, Rank::Eight, Rank::Nine, Rank::Ten],
    );
    let spades = straight_flush(
        Suit::Spades,
        [Rank::Six, Rank::Seven, Rank::Eight, Rank::Nine, Rank::Ten],
    );

    let hearts_strength = strength_basic(&hearts).unwrap();
    let spades_strength = strength_basic(&spades).unwrap();

    assert!(!beats_at_level(hearts_strength, spades_strength, Rank::Five));
    assert!(!beats_at_level(spades_strength, hearts_strength, Rank::Five));
}
