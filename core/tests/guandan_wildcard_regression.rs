use shengji_core::guandan::{
    rules::classify_at_level,
    strength::strengths_at_level,
    CardFace, PlayPattern, Rank, Suit,
};

fn card(suit: Suit, rank: Rank) -> CardFace {
    CardFace::Suited { suit, rank }
}

#[test]
fn heart_level_three_completes_888_99_into_consecutive_triples() {
    let cards = [
        card(Suit::Hearts, Rank::Three),
        card(Suit::Diamonds, Rank::Eight),
        card(Suit::Spades, Rank::Eight),
        card(Suit::Hearts, Rank::Eight),
        card(Suit::Diamonds, Rank::Nine),
        card(Suit::Diamonds, Rank::Nine),
    ];

    let patterns = classify_at_level(&cards, Rank::Three);
    assert!(patterns.contains(&PlayPattern::ConsecutiveTriples));

    let strengths = strengths_at_level(&cards, Rank::Three);
    assert!(strengths.iter().any(|strength| {
        strength.pattern == PlayPattern::ConsecutiveTriples
            && strength.main_rank == Rank::Nine
            && strength.card_count == 6
    }));
}
