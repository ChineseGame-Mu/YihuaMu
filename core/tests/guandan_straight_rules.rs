use shengji_core::guandan::{
    rules::classify_basic, strength::strength_basic, CardFace, PlayPattern, Rank, Suit,
};

fn card(suit: Suit, rank: Rank) -> CardFace {
    CardFace::Suited { suit, rank }
}

#[test]
fn ten_to_ace_is_legal_and_ace_high() {
    let cards = [
        card(Suit::Clubs, Rank::Ten),
        card(Suit::Diamonds, Rank::Jack),
        card(Suit::Hearts, Rank::Queen),
        card(Suit::Spades, Rank::King),
        card(Suit::Clubs, Rank::Ace),
    ];

    assert_eq!(classify_basic(&cards), Some(PlayPattern::Straight));
    let strength = strength_basic(&cards).expect("10-J-Q-K-A should have strength");
    assert_eq!(strength.main_rank, Rank::Ace);
}

#[test]
fn ace_to_five_is_legal_and_five_high() {
    let cards = [
        card(Suit::Clubs, Rank::Ace),
        card(Suit::Diamonds, Rank::Two),
        card(Suit::Hearts, Rank::Three),
        card(Suit::Spades, Rank::Four),
        card(Suit::Clubs, Rank::Five),
    ];

    assert_eq!(classify_basic(&cards), Some(PlayPattern::Straight));
    let strength = strength_basic(&cards).expect("A-2-3-4-5 should have strength");
    assert_eq!(strength.main_rank, Rank::Five);
}

#[test]
fn jqka_two_wraparound_is_illegal() {
    let cards = [
        card(Suit::Clubs, Rank::Jack),
        card(Suit::Diamonds, Rank::Queen),
        card(Suit::Hearts, Rank::King),
        card(Suit::Spades, Rank::Ace),
        card(Suit::Clubs, Rank::Two),
    ];

    assert_eq!(classify_basic(&cards), None);
    assert_eq!(strength_basic(&cards), None);
}

#[test]
fn jqka_level_tail_wraparound_is_illegal() {
    let cards = [
        card(Suit::Clubs, Rank::Jack),
        card(Suit::Diamonds, Rank::Queen),
        card(Suit::Hearts, Rank::King),
        card(Suit::Spades, Rank::Ace),
        card(Suit::Clubs, Rank::Three),
    ];

    assert_eq!(classify_basic(&cards), None);
    assert_eq!(strength_basic(&cards), None);
}
