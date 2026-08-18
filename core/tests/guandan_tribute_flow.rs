use shengji_core::guandan::{
    tribute::{can_resist_tribute, four_player_tribute_plan, TributePlan},
    CardFace, Joker, Rank, Suit, TableConfig,
};

fn card(suit: Suit, rank: Rank) -> CardFace {
    CardFace::Suited { suit, rank }
}

#[test]
fn one_two_finish_without_two_big_jokers_requires_double_tribute() {
    let table = TableConfig::new(4).unwrap();
    let plan = four_player_tribute_plan(table, &[0, 2, 1]).unwrap();
    assert_eq!(
        plan,
        TributePlan::Double {
            givers: [1, 3],
            receivers: [0, 2]
        }
    );

    let hands = vec![
        vec![card(Suit::Clubs, Rank::Two)],
        vec![CardFace::Joker(Joker::Big)],
        vec![card(Suit::Diamonds, Rank::Three)],
        vec![card(Suit::Spades, Rank::Ace)],
    ];
    assert!(!can_resist_tribute(&plan, &hands));
}

#[test]
fn ordinary_finish_without_two_big_jokers_requires_single_tribute() {
    let table = TableConfig::new(4).unwrap();
    let plan = four_player_tribute_plan(table, &[0, 1, 2]).unwrap();
    assert_eq!(
        plan,
        TributePlan::Single {
            giver: 3,
            receiver: 0
        }
    );

    let hands = vec![
        vec![card(Suit::Clubs, Rank::Two)],
        vec![],
        vec![],
        vec![CardFace::Joker(Joker::Big), card(Suit::Spades, Rank::Ace)],
    ];
    assert!(!can_resist_tribute(&plan, &hands));
}

#[test]
fn ordinary_finish_with_two_big_jokers_skips_single_tribute() {
    let table = TableConfig::new(4).unwrap();
    let plan = four_player_tribute_plan(table, &[0, 1, 2]).unwrap();
    let hands = vec![
        vec![card(Suit::Clubs, Rank::Two)],
        vec![],
        vec![],
        vec![CardFace::Joker(Joker::Big), CardFace::Joker(Joker::Big)],
    ];
    assert!(can_resist_tribute(&plan, &hands));
}
