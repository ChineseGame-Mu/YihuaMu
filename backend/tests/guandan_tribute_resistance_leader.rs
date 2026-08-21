use shengji_core::guandan::{
    tribute::{can_resist_tribute, four_player_tribute_plan, TributePlan},
    CardFace, Joker, Rank, Suit, TableConfig,
};

fn card(suit: Suit, rank: Rank) -> CardFace {
    CardFace::Suited { suit, rank }
}

#[test]
fn single_tribute_resistance_keeps_receiver_as_opening_player() {
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
        vec![],
        vec![],
        vec![CardFace::Joker(Joker::Big), CardFace::Joker(Joker::Big)],
    ];
    assert!(can_resist_tribute(&plan, &hands));

    let opening_player = match plan {
        TributePlan::Single { receiver, .. } => receiver,
        TributePlan::Double { receivers, .. } => receivers[0],
    };
    assert_eq!(opening_player, 0);
}

#[test]
fn double_tribute_resistance_keeps_first_receiver_as_opening_player() {
    let table = TableConfig::new(4).unwrap();
    let plan = four_player_tribute_plan(table, &[0, 2, 1]).unwrap();
    assert_eq!(
        plan,
        TributePlan::Double {
            givers: [1, 3],
            receivers: [0, 2],
        }
    );

    let hands = vec![
        vec![card(Suit::Clubs, Rank::Two)],
        vec![CardFace::Joker(Joker::Big)],
        vec![],
        vec![CardFace::Joker(Joker::Big)],
    ];
    assert!(can_resist_tribute(&plan, &hands));

    let opening_player = match plan {
        TributePlan::Single { receiver, .. } => receiver,
        TributePlan::Double { receivers, .. } => receivers[0],
    };
    assert_eq!(opening_player, 0);
}
