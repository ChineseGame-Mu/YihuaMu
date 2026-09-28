//! Four-player Guandan tribute / return-card scaffolding.
//!
//! This follows the common Jiangsu rules used by the rest of the four-player
//! finish-order implementation: from the second deal onward, last place pays
//! tribute to first place; after a 1-2 finish (double-down), both losing players
//! pay tribute to the two winners. Holding both big jokers on the tribute side
//! resists tribute.

use std::convert::TryInto;

use serde::{Deserialize, Serialize};

use super::{team::team_for_seat, CardFace, Joker, TableConfig};

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub enum TributePlan {
    /// Last place pays tribute to first place.
    Single { giver: usize, receiver: usize },
    /// Both losing players pay tribute. Pairing is resolved after comparing the
    /// two offered tribute cards: first place receives the larger card and the
    /// partner receives the smaller card (ties use current seat order).
    Double {
        givers: [usize; 2],
        receivers: [usize; 2],
    },
    /// Expanded tables exchange one tribute card per player on each side.
    /// Both lists are in finish order; equal tribute values use seat order.
    Multi {
        givers: Vec<usize>,
        receivers: Vec<usize>,
    },
}

/// Build tribute for any supported table. Four-player rules keep their
/// standard single/double cases. On larger tables, the first team to sweep
/// half the places receives one card from each player in the opposite half.
pub fn tribute_plan(
    table: TableConfig,
    finish_order: &[usize],
) -> Result<Option<TributePlan>, &'static str> {
    if table.player_count == 4 {
        return four_player_tribute_plan(table, finish_order).map(Some);
    }
    if !(6..=14).contains(&table.player_count) || !table.player_count.is_multiple_of(2) {
        return Err("tribute is supported for four-player or 6 to 14 player tables");
    }
    let count = table.player_count;
    let mut seen = vec![false; count];
    if !(count - 1..=count).contains(&finish_order.len())
        || finish_order.iter().any(|seat| {
            if *seat >= count || seen[*seat] {
                true
            } else {
                seen[*seat] = true;
                false
            }
        })
    {
        return Err("expanded tribute requires a valid finish order");
    }
    let mut complete_order = finish_order.to_vec();
    if complete_order.len() == count - 1 {
        complete_order.push(
            (0..count)
                .find(|seat| !seen[*seat])
                .ok_or("missing final seat in expanded finish order")?,
        );
    }
    let half = count / 2;
    let winner_team = team_for_seat(table, complete_order[0])?;
    if complete_order[..half]
        .iter()
        .any(|seat| team_for_seat(table, *seat).ok() != Some(winner_team))
    {
        return Ok(None);
    }
    Ok(Some(TributePlan::Multi {
        givers: complete_order[half..].to_vec(),
        receivers: complete_order[..half].to_vec(),
    }))
}

/// Build the tribute obligation from the previous deal's finish order.
/// `finish_order` is zero-based seat order, first place first. The fourth seat
/// may be omitted because it is uniquely determined from the other three.
pub fn four_player_tribute_plan(
    table: TableConfig,
    finish_order: &[usize],
) -> Result<TributePlan, &'static str> {
    if table.player_count != 4 {
        return Err("tribute plan is defined here for four-player Guandan");
    }
    let first = *finish_order.first().ok_or("finish order is empty")?;
    if first >= 4 {
        return Err("finish order contains an invalid seat");
    }

    let full_order = complete_four_player_finish_order(finish_order)?;
    let second = full_order[1];
    let last = full_order[3];
    let first_team = team_for_seat(table, first)?;
    let second_team = team_for_seat(table, second)?;

    if first_team == second_team {
        let losing = [full_order[2], full_order[3]];
        Ok(TributePlan::Double {
            givers: losing,
            receivers: [first, second],
        })
    } else {
        Ok(TributePlan::Single {
            giver: last,
            receiver: first,
        })
    }
}

/// Whether the tribute side may resist tribute because it collectively holds
/// both big jokers. For a single tribute this means the lone giver has both;
/// for double tribute the two givers together may hold one each or one giver
/// may hold both.
pub fn can_resist_tribute(plan: &TributePlan, hands: &[Vec<CardFace>]) -> bool {
    match plan {
        TributePlan::Single { giver, .. } => hands
            .get(*giver)
            .map(|hand| count_big_jokers(hand) >= 2)
            .unwrap_or(false),
        TributePlan::Double { givers, .. } => {
            givers
                .iter()
                .filter_map(|seat| hands.get(*seat))
                .map(|hand| count_big_jokers(hand))
                .sum::<usize>()
                >= 2
        }
        TributePlan::Multi { givers, .. } => {
            givers
                .iter()
                .filter_map(|seat| hands.get(*seat))
                .map(|hand| count_big_jokers(hand))
                .sum::<usize>()
                >= 2
        }
    }
}

fn count_big_jokers(hand: &[CardFace]) -> usize {
    hand.iter()
        .filter(|card| matches!(card, CardFace::Joker(Joker::Big)))
        .count()
}

fn complete_four_player_finish_order(order: &[usize]) -> Result<[usize; 4], &'static str> {
    if !(3..=4).contains(&order.len()) {
        return Err("four-player finish order must contain three or four seats");
    }
    let mut seen = [false; 4];
    for &seat in order {
        if seat >= 4 || seen[seat] {
            return Err("finish order contains an invalid or repeated seat");
        }
        seen[seat] = true;
    }

    let mut full = Vec::with_capacity(4);
    full.extend_from_slice(order);
    if order.len() == 3 {
        full.push(
            (0..4)
                .find(|seat| !seen[*seat])
                .ok_or("missing fourth-place seat")?,
        );
    }
    full.try_into()
        .map_err(|_| "could not build four-player finish order")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::guandan::{Rank, Suit};

    fn card(suit: Suit, rank: Rank) -> CardFace {
        CardFace::Suited { suit, rank }
    }

    #[test]
    fn ordinary_result_makes_last_pay_first() {
        let table = TableConfig::new(4).unwrap();
        assert_eq!(
            four_player_tribute_plan(table, &[0, 1, 2]).unwrap(),
            TributePlan::Single {
                giver: 3,
                receiver: 0
            }
        );
        assert_eq!(
            four_player_tribute_plan(table, &[0, 1, 3]).unwrap(),
            TributePlan::Single {
                giver: 2,
                receiver: 0
            }
        );
    }

    #[test]
    fn one_two_finish_creates_double_tribute() {
        let table = TableConfig::new(4).unwrap();
        assert_eq!(
            four_player_tribute_plan(table, &[0, 2, 1]).unwrap(),
            TributePlan::Double {
                givers: [1, 3],
                receivers: [0, 2]
            }
        );
    }

    #[test]
    fn single_tribute_resists_only_with_two_big_jokers() {
        let plan = TributePlan::Single {
            giver: 3,
            receiver: 0,
        };
        let mut hands = vec![vec![], vec![], vec![], vec![CardFace::Joker(Joker::Big)]];
        assert!(!can_resist_tribute(&plan, &hands));
        hands[3].push(CardFace::Joker(Joker::Big));
        assert!(can_resist_tribute(&plan, &hands));
    }

    #[test]
    fn double_tribute_resists_when_givers_collectively_hold_two_big_jokers() {
        let plan = TributePlan::Double {
            givers: [1, 3],
            receivers: [0, 2],
        };
        let hands = vec![
            vec![card(Suit::Clubs, Rank::Two)],
            vec![CardFace::Joker(Joker::Big)],
            vec![],
            vec![CardFace::Joker(Joker::Big)],
        ];
        assert!(can_resist_tribute(&plan, &hands));
    }

    #[test]
    fn double_tribute_does_not_resist_with_only_one_big_joker() {
        let plan = TributePlan::Double {
            givers: [1, 3],
            receivers: [0, 2],
        };
        let hands = vec![
            vec![],
            vec![CardFace::Joker(Joker::Big)],
            vec![],
            vec![card(Suit::Clubs, Rank::Ace)],
        ];
        assert!(!can_resist_tribute(&plan, &hands));
    }

    #[test]
    fn double_tribute_resists_when_one_giver_holds_both_big_jokers() {
        let plan = TributePlan::Double {
            givers: [1, 3],
            receivers: [0, 2],
        };
        let hands = vec![
            vec![],
            vec![CardFace::Joker(Joker::Big), CardFace::Joker(Joker::Big)],
            vec![],
            vec![card(Suit::Spades, Rank::King)],
        ];
        assert!(can_resist_tribute(&plan, &hands));
    }

    #[test]
    fn one_two_finish_flows_directly_into_double_joker_resistance() {
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
            vec![CardFace::Joker(Joker::Big)],
        ];
        assert!(can_resist_tribute(&plan, &hands));
    }

    #[test]
    fn expanded_sweep_creates_one_exchange_per_player_in_each_half() {
        for player_count in (6..=14).step_by(2) {
            let table = TableConfig::new(player_count).unwrap();
            let mut order = (0..player_count).step_by(2).collect::<Vec<_>>();
            order.extend((1..player_count).step_by(2));
            assert_eq!(
                tribute_plan(table, &order).unwrap(),
                Some(TributePlan::Multi {
                    givers: (1..player_count).step_by(2).collect(),
                    receivers: (0..player_count).step_by(2).collect(),
                }),
                "tribute plan should cover {player_count} seats"
            );
            let mut incomplete = order;
            incomplete.pop();
            assert_eq!(
                tribute_plan(table, &incomplete).unwrap(),
                Some(TributePlan::Multi {
                    givers: (1..player_count).step_by(2).collect(),
                    receivers: (0..player_count).step_by(2).collect(),
                }),
                "infer the final seat for {player_count} seats"
            );
        }
    }

    #[test]
    fn expanded_non_sweep_has_no_tribute_plan() {
        let table = TableConfig::new(8).unwrap();
        assert_eq!(
            tribute_plan(table, &[0, 1, 2, 4, 3, 5, 6, 7]).unwrap(),
            None
        );
    }
}
