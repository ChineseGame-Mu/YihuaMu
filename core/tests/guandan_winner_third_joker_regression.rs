use shengji_core::guandan::{
    tribute::{can_resist_tribute, four_player_tribute_plan, TributePlan},
    CardFace, Joker, Rank, Suit, TableConfig,
};

#[test]
fn first_and_third_place_winning_team_jokers_do_not_cancel_loser_tribute() {
    // A: seats 0 and 2. B: seats 1 and 3. Finish: A1, B1, A2, B2.
    let table = TableConfig::new(4).unwrap();
    let plan = four_player_tribute_plan(table, &[0, 1, 2]).unwrap();
    assert_eq!(plan, TributePlan::Single { giver: 3, receiver: 0 });

    let hands = vec![
        vec![CardFace::Suited { suit: Suit::Clubs, rank: Rank::Three }],
        vec![CardFace::Suited { suit: Suit::Diamonds, rank: Rank::Four }],
        vec![CardFace::Joker(Joker::Big), CardFace::Joker(Joker::Big)],
        vec![CardFace::Suited { suit: Suit::Hearts, rank: Rank::Five }],
    ];
    assert!(!can_resist_tribute(&plan, &hands));
}
