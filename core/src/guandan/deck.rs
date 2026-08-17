//! Deck construction/dealing for 4-14 player Guandan tables.

use super::{CardFace, Joker, Rank, Suit, TableConfig};

pub const CARDS_PER_PLAYER: usize = 27;

/// Number of standard 54-card decks required so every player receives 27 cards.
/// Even tables consume the full deck set; odd tables leave 27 undealt cards.
pub fn deck_count(table: TableConfig) -> usize {
    table.player_count.div_ceil(2)
}

pub fn build_deck(table: TableConfig) -> Vec<CardFace> {
    let ranks = [Rank::Two, Rank::Three, Rank::Four, Rank::Five, Rank::Six, Rank::Seven,
        Rank::Eight, Rank::Nine, Rank::Ten, Rank::Jack, Rank::Queen, Rank::King, Rank::Ace];
    let suits = [Suit::Clubs, Suit::Diamonds, Suit::Hearts, Suit::Spades];
    let mut deck = Vec::with_capacity(deck_count(table) * 54);
    for _ in 0..deck_count(table) {
        for suit in suits {
            for rank in ranks {
                deck.push(CardFace::Suited { suit, rank });
            }
        }
        deck.push(CardFace::Joker(Joker::Small));
        deck.push(CardFace::Joker(Joker::Big));
    }
    deck
}

/// Deals 27 cards per seat from an already shuffled deck.
/// The caller owns shuffling so deterministic tests remain simple.
pub fn deal(table: TableConfig, deck: &[CardFace]) -> Result<(Vec<Vec<CardFace>>, Vec<CardFace>), &'static str> {
    let required = table.player_count * CARDS_PER_PLAYER;
    if deck.len() < required {
        return Err("deck does not contain enough cards for this table");
    }
    let mut hands = vec![Vec::with_capacity(CARDS_PER_PLAYER); table.player_count];
    for (index, card) in deck.iter().take(required).copied().enumerate() {
        hands[index % table.player_count].push(card);
    }
    Ok((hands, deck[required..].to_vec()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn even_tables_use_exact_number_of_decks() {
        for players in [4usize, 6, 8, 10, 12, 14] {
            let table = TableConfig::new(players).unwrap();
            assert_eq!(deck_count(table), players / 2);
            assert_eq!(build_deck(table).len(), players * CARDS_PER_PLAYER);
        }
    }

    #[test]
    fn odd_tables_leave_half_a_deck_undealt() {
        for players in [5usize, 7, 9, 11, 13] {
            let table = TableConfig::new(players).unwrap();
            let deck = build_deck(table);
            let (hands, remainder) = deal(table, &deck).unwrap();
            assert!(hands.iter().all(|hand| hand.len() == CARDS_PER_PLAYER));
            assert_eq!(remainder.len(), 27);
        }
    }

    #[test]
    fn fourteen_players_each_receive_twenty_seven_cards() {
        let table = TableConfig::new(14).unwrap();
        let deck = build_deck(table);
        let (hands, remainder) = deal(table, &deck).unwrap();
        assert_eq!(hands.len(), 14);
        assert!(hands.iter().all(|hand| hand.len() == 27));
        assert!(remainder.is_empty());
    }
}
