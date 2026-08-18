use shengji_core::guandan::{
    tribute::{can_resist_tribute, four_player_tribute_plan, TributePlan},
    CardFace, Joker, Rank, Suit, TableConfig,
};

fn card(suit: Suit, rank: Rank) -> CardFace {
    CardFace::Suited { suit, rank }
}

#[test]
fn one_three_finish_flows_into_single_double_joker_resistance() {
    let table = TableConfig::new(4).unwrap();
    let plan = four_player_tribute_plan(table, &[0, 1, 2]).unwrap();
    assert_eq!(
        plan,
        TributePlan::Single {
            giver: 3,
            receiver: 0,
        }
    );

    let hands = vec![
        vec![card(Suit::Clubs, Rank::Two)],
        vec![card(Suit::Diamonds, Rank::Three)],
        vec![card(Suit::Hearts, Rank::Four)],
        vec![CardFace::Joker(Joker::Big), CardFace::Joker(Joker::Big)],
    ];

    assert!(can_resist_tribute(&plan, &hands));
}
