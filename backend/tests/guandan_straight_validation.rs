use shengji_core::guandan::{
    compare::beats_at_level, strength::strength_basic, CardFace, Rank, Suit,
};

fn card(suit: Suit, rank: Rank) -> CardFace {
    CardFace::Suited { suit, rank }
}

fn straight(ranks: [Rank; 5]) -> Vec<CardFace> {
    let suits = [
        Suit::Clubs,
        Suit::Diamonds,
        Suit::Hearts,
        Suit::Spades,
        Suit::Clubs,
    ];
    ranks
        .into_iter()
        .zip(suits)
        .map(|(rank, suit)| card(suit, rank))
        .collect()
}

#[test]
fn ace_low_is_legal_and_five_high() {
    let ace_low = straight([
        Rank::Ace,
        Rank::Two,
        Rank::Three,
        Rank::Four,
        Rank::Five,
    ]);
    let six_high = straight([
        Rank::Two,
        Rank::Three,
        Rank::Four,
        Rank::Five,
        Rank::Six,
    ]);

    let ace_low_strength = strength_basic(&ace_low).expect("A2345 should be legal");
    let six_high_strength = strength_basic(&six_high).expect("23456 should be legal");

    assert_eq!(ace_low_strength.main_rank, Rank::Five);
    assert!(beats_at_level(six_high_strength, ace_low_strength, Rank::Nine));
    assert!(!beats_at_level(ace_low_strength, six_high_strength, Rank::Nine));
}

#[test]
fn ten_to_ace_is_the_highest_natural_straight() {
    let nine_high = straight([
        Rank::Five,
        Rank::Six,
        Rank::Seven,
        Rank::Eight,
        Rank::Nine,
    ]);
    let ace_high = straight([
        Rank::Ten,
        Rank::Jack,
        Rank::Queen,
        Rank::King,
        Rank::Ace,
    ]);

    let nine_high_strength = strength_basic(&nine_high).expect("56789 should be legal");
    let ace_high_strength = strength_basic(&ace_high).expect("10JQKA should be legal");

    assert_eq!(ace_high_strength.main_rank, Rank::Ace);
    assert!(beats_at_level(ace_high_strength, nine_high_strength, Rank::Three));
    assert!(!beats_at_level(nine_high_strength, ace_high_strength, Rank::Three));
}

#[test]
fn wraparound_sequences_are_rejected() {
    let jqka_two = straight([
        Rank::Jack,
        Rank::Queen,
        Rank::King,
        Rank::Ace,
        Rank::Two,
    ]);
    let jqka_three = straight([
        Rank::Jack,
        Rank::Queen,
        Rank::King,
        Rank::Ace,
        Rank::Three,
    ]);

    assert!(strength_basic(&jqka_two).is_none());
    assert!(strength_basic(&jqka_three).is_none());
}
