use shengji_core::guandan::{
    deck::{build_deck, deal, CARDS_PER_PLAYER},
    TableConfig,
};

#[test]
fn four_player_guandan_deals_twenty_seven_cards_each_without_remainder() {
    let table = TableConfig::new(4).expect("four-player Guandan table should be valid");
    let deck = build_deck(table);

    assert_eq!(deck.len(), 108);

    let (hands, remainder) = deal(table, &deck).expect("four-player Guandan deal should succeed");

    assert_eq!(hands.len(), 4);
    assert!(hands.iter().all(|hand| hand.len() == CARDS_PER_PLAYER));
    assert_eq!(hands.iter().map(Vec::len).sum::<usize>(), 108);
    assert!(remainder.is_empty());
}
