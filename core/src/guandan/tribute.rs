//! Guandan tribute / return-card planning for 4 through 14 players.
//!
//! The expanded-table rule keeps the same finish-order semantics as classic
//! four-player Guandan: normally last place pays tribute to first place. If the
//! first two finishers are on the same team, the last two players from the
//! opposing team pay double tribute to the first two finishers. Holding both big
//! jokers on the tribute side resists tribute.

use serde::{Deserialize, Serialize};

use super::{team::team_for_seat, CardFace, Joker, TableConfig};

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub enum TributePlan {
    /// Last place pays tribute to first place.
    Single { giver: usize, receiver: usize },
    /// Two losing players pay tribute. Pairing is resolved after comparing the
    /// two offered tribute cards: first place receives the larger card and the
    /// second receiver receives the smaller card (ties use table order).
    Double {
        givers: [usize; 2],
        receivers: [usize; 2],
    },
}

/// Build the tribute obligation from the previous deal's finish order for any
/// supported even table size from 4 through 14 players. The final-place seat may
/// be omitted because it is uniquely determined from the other seats.
pub fn tribute_plan(
    table: TableConfig,
    finish_order: &[usize],
) -> Result<TributePlan, &'static str> {
    let player_count = table.player_count;
    if !(4..=14).contains(&player_count) || !player_count.is_multiple_of(2) {
        return Err("tribute plan requires an even Guandan table from 4 through 14 players");
    }
    if finish_order.len() != player_count && finish_order.len() != player_count - 1 {
        return Err("finish order must contain all seats or omit only final place");
    }

    let mut seen = vec![false; player_count];
    let mut full_order = Vec::with_capacity(player_count);
    for &seat in finish_order {
        if seat >= player_count || seen[seat] {
            return Err("finish order contains an invalid or repeated seat");
        }
        seen[seat] = true;
        full_order.push(seat);
    }
    if full_order.len() == player_count - 1 {
        full_order.push(
            (0..player_count)
                .find(|seat| !seen[*seat])
                .ok_or("missing final-place seat")?,
        );
    }

    let first = full_order[0];
    let second = full_order[1];
    let first_team = team_for_seat(table, first)?;
    let second_team = team_for_seat(table, second)?;

    if first_team == second_team {
        let mut losing_finishers = full_order
            .iter()
            .rev()
            .copied()
            .filter(|seat| team_for_seat(table, *seat).ok() != Some(first_team));
        let last = losing_finishers
            .next()
            .ok_or("could not identify first tribute giver")?;
        let second_last = losing_finishers
            .next()
            .ok_or("could not identify second tribute giver")?;
        Ok(TributePlan::Double {
            givers: [second_last, last],
            receivers: [first, second],
        })
    } else {
        Ok(TributePlan::Single {
            giver: *full_order.last().ok_or("finish order is empty")?,
            receiver: first,
        })
    }
}

/// Backward-compatible four-player entry point.
pub fn four_player_tribute_plan(
    table: TableConfig,
    finish_order: &[usize],
) -> Result<TributePlan, &'static str> {
    if table.player_count != 4 {
        return Err("four-player tribute plan requires four players");
    }
    tribute_plan(table, finish_order)
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
    }
}

fn count_big_jokers(hand: &[CardFace]) -> usize {
    hand.iter()
        .filter(|card| matches!(card, CardFace::Joker(Joker::Big)))
        .count()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::guandan::{Rank, Suit};

    fn card(suit: Suit, rank: Rank) -> CardFace {
        CardFace::Suited { suit, rank }
    }

    #[test]
    fn four_player_ordinary_result_makes_last_pay_first() {
        let table = TableConfig::new(4).unwrap();
        assert_eq!(
            tribute_plan(table, &[0, 1, 2]).unwrap(),
            TributePlan::Single {
                giver: 3,
                receiver: 0
            }
        );
    }

    #[test]
    fn four_player_one_two_finish_creates_double_tribute() {
        let table = TableConfig::new(4).unwrap();
        assert_eq!(
            tribute_plan(table, &[0, 2, 1]).unwrap(),
            TributePlan::Double {
                givers: [1, 3],
                receivers: [0, 2]
            }
        );
    }

    #[test]
    fn six_player_ordinary_result_makes_last_pay_first() {
        let table = TableConfig::new(6).unwrap();
        assert_eq!(
            tribute_plan(table, &[0, 1, 2, 3, 4]).unwrap(),
            TributePlan::Single {
                giver: 5,
                receiver: 0
            }
        );
    }

    #[test]
    fn six_player_same_team_top_two_creates_double_tribute() {
        let table = TableConfig::new(6).unwrap();
        assert_eq!(
            tribute_plan(table, &[0, 2, 1, 4, 3]).unwrap(),
            TributePlan::Double {
                givers: [3, 5],
                receivers: [0, 2]
            }
        );
    }

    #[test]
    fn fourteen_player_plan_accepts_complete_order() {
        let table = TableConfig::new(14).unwrap();
        let order = (0..14).collect::<Vec<_>>();
        assert_eq!(
            tribute_plan(table, &order).unwrap(),
            TributePlan::Single {
                giver: 13,
                receiver: 0
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
}
