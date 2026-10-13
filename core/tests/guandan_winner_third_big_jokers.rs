use shengji_core::guandan::{
    tribute::{can_resist_tribute, tribute_plan, TributePlan},
    CardFace, Joker, TableConfig,
};

fn big_joker() -> CardFace {
    CardFace::Joker(Joker::Big)
}

#[test]
fn winner_team_third_place_holding_both_big_jokers_does_not_resist_single_tribute() {
    // A1 wins, B1 finishes second, A2 finishes third, B2 finishes last.
    // Only B2 owes tribute: A2's jokers cannot exempt B2.
    let plan = tribute_plan(TableConfig::new(4).unwrap(), &[0, 1, 2]).unwrap();
    assert_eq!(
        plan,
        TributePlan::Single {
            giver: 3,
            receiver: 0,
        }
    );
    let hands = vec![vec![], vec![], vec![big_joker(), big_joker()], vec![]];
    assert!(!can_resist_tribute(&plan, &hands));
}

#[test]
fn only_actual_single_tribute_giver_holding_both_big_jokers_can_resist() {
    let plan = tribute_plan(TableConfig::new(4).unwrap(), &[0, 1, 2]).unwrap();
    let hands = vec![vec![], vec![], vec![], vec![big_joker(), big_joker()]];
    assert!(can_resist_tribute(&plan, &hands));
}

#[test]
fn winner_team_third_place_jokers_do_not_exempt_double_tribute_givers() {
    // A1 and A2 finish first and second: B1 and B2 must pay double tribute.
    let plan = tribute_plan(TableConfig::new(4).unwrap(), &[0, 2, 1]).unwrap();
    assert_eq!(
        plan,
        TributePlan::Double {
            givers: [1, 3],
            receivers: [0, 2],
        }
    );
    let hands = vec![vec![], vec![], vec![big_joker(), big_joker()], vec![]];
    assert!(!can_resist_tribute(&plan, &hands));
}

#[test]
fn double_tribute_givers_collectively_holding_both_big_jokers_can_resist() {
    let plan = tribute_plan(TableConfig::new(4).unwrap(), &[0, 2, 1]).unwrap();
    let hands = vec![vec![], vec![big_joker()], vec![], vec![big_joker()]];
    assert!(can_resist_tribute(&plan, &hands));
}
