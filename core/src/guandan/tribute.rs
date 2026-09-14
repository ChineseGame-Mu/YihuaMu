use crate::{CardFace, Joker};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TributePlan {
    Single { giver: usize, receiver: usize },
    Double { givers: [usize; 2], receivers: [usize; 2] },
}

pub fn tribute_plan(finishing_order: &[usize]) -> Option<TributePlan> {
    if finishing_order.len() < 4 {
        return None;
    }

    let first = finishing_order[0];
    let second = finishing_order[1];
    let last = *finishing_order.last()?;
    let second_last = finishing_order[finishing_order.len() - 2];

    if first % 2 == second % 2 {
        return Some(TributePlan::Double {
            givers: [second_last, last],
            receivers: [first, second],
        });
    }

    Some(TributePlan::Single {
        giver: last,
        receiver: first,
    })
}

pub fn tribute_is_resisted(hands: &[Vec<CardFace>], plan: &TributePlan) -> bool {
    if hands.is_empty() {
        return false;
    }

    if hands.len() == 4 {
        return match plan {
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
        };
    }

    if !(6..=14).contains(&hands.len()) || !hands.len().is_multiple_of(2) {
        return false;
    }

    let losing_parity = match plan {
        TributePlan::Single { giver, .. } => *giver % 2,
        TributePlan::Double { givers, .. } => {
            if givers[0] % 2 != givers[1] % 2 {
                return false;
            }
            givers[0] % 2
        }
    };

    let expected_big_jokers = hands.len() / 2;
    let total_big_jokers = hands
        .iter()
        .map(|hand| count_big_jokers(hand))
        .sum::<usize>();
    if total_big_jokers != expected_big_jokers {
        return false;
    }

    let losing_team_big_jokers = hands
        .iter()
        .enumerate()
        .filter(|(seat, _)| seat % 2 == losing_parity)
        .map(|(_, hand)| count_big_jokers(hand))
        .sum::<usize>();

    losing_team_big_jokers == expected_big_jokers
}

fn count_big_jokers(hand: &[CardFace]) -> usize {
    hand.iter()
        .filter(|card| matches!(card, CardFace::Joker(Joker::Big)))
        .count()
}
