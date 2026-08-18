//! Team layout and level progression for multiplayer Guandan.
//!
//! Even tables use two alternating teams around the table, matching the
//! familiar partner-opposite/alternating seating idea while scaling to 14.
//! Standard four-player Guandan uses finish-order based promotion: 1-2 = +3,
//! 1-3 = +2, 1-4 = +1. Larger even tables remain supported by the multiplayer
//! test mode and currently use the single-step fallback in the backend.

use serde::{Deserialize, Serialize};

use super::{level::next_level, Rank, TableConfig};

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub enum Team {
    A,
    B,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct TeamLevels {
    pub team_a: Rank,
    pub team_b: Rank,
}

impl Default for TeamLevels {
    fn default() -> Self {
        Self {
            team_a: Rank::Two,
            team_b: Rank::Two,
        }
    }
}

impl TeamLevels {
    pub fn level_for(self, team: Team) -> Rank {
        match team {
            Team::A => self.team_a,
            Team::B => self.team_b,
        }
    }

    /// Winning while already playing Ace is potentially terminal. The caller
    /// must still verify the required finish result for an Ace-level win.
    pub fn wins_match(self, winner: Team) -> bool {
        self.level_for(winner) == Rank::Ace
    }

    /// Advance exactly the winning team by one level.
    pub fn advance_winner(&mut self, winner: Team) -> Rank {
        self.advance_winner_by(winner, 1)
    }

    /// Advance only the winning team by `steps` levels. Ace is never skipped
    /// and remains terminal.
    pub fn advance_winner_by(&mut self, winner: Team, steps: usize) -> Rank {
        let level = match winner {
            Team::A => &mut self.team_a,
            Team::B => &mut self.team_b,
        };
        for _ in 0..steps {
            *level = next_level(*level);
        }
        *level
    }
}

pub fn team_for_seat(table: TableConfig, seat: usize) -> Result<Team, &'static str> {
    if seat >= table.player_count {
        return Err("seat is outside the table");
    }
    if !table.is_even_table() {
        return Err("team mode requires an even player count");
    }
    Ok(if seat.is_multiple_of(2) {
        Team::A
    } else {
        Team::B
    })
}

pub fn teammates(table: TableConfig, seat: usize) -> Result<Vec<usize>, &'static str> {
    let team = team_for_seat(table, seat)?;
    Ok(table
        .seat_numbers()
        .filter(|other| {
            *other != seat && team_for_seat(table, *other).ok() == Some(team)
        })
        .collect())
}

/// Standard four-player Guandan promotion based on where the first finisher's
/// partner places. `finish_order` is zero-based seat order, first place first.
/// The fourth player may be omitted because they are the only player left.
pub fn four_player_promotion_steps(
    table: TableConfig,
    finish_order: &[usize],
) -> Result<usize, &'static str> {
    if table.player_count != 4 {
        return Err("finish-order promotion is defined here for four-player Guandan");
    }
    let winner = *finish_order.first().ok_or("finish order is empty")?;
    let winner_team = team_for_seat(table, winner)?;

    let partner_place = (1..4)
        .find(|place| {
            let seat = if *place < finish_order.len() {
                finish_order[*place]
            } else {
                (0..4)
                    .find(|seat| !finish_order.contains(seat))
                    .unwrap_or(usize::MAX)
            };
            team_for_seat(table, seat).ok() == Some(winner_team)
        })
        .map(|place| place + 1)
        .ok_or("winner partner not found in finish order")?;

    match partner_place {
        2 => Ok(3),
        3 => Ok(2),
        4 => Ok(1),
        _ => Err("invalid partner finishing place"),
    }
}

/// At Ace, standard four-player play requires the winner's partner not to be
/// last: 1-2 or 1-3 wins the match; 1-4 stays on Ace.
pub fn four_player_ace_win(
    table: TableConfig,
    finish_order: &[usize],
) -> Result<bool, &'static str> {
    Ok(four_player_promotion_steps(table, finish_order)? >= 2)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn four_player_layout_matches_opposite_partners() {
        let t = TableConfig::new(4).unwrap();
        assert_eq!(teammates(t, 0).unwrap(), vec![2]);
        assert_eq!(teammates(t, 1).unwrap(), vec![3]);
    }

    #[test]
    fn fourteen_player_layout_alternates_two_seven_player_teams() {
        let t = TableConfig::new(14).unwrap();
        assert_eq!(teammates(t, 0).unwrap(), vec![2, 4, 6, 8, 10, 12]);
        assert_eq!(teammates(t, 13).unwrap(), vec![1, 3, 5, 7, 9, 11]);
    }

    #[test]
    fn odd_tables_are_not_forced_into_unequal_teams() {
        let t = TableConfig::new(5).unwrap();
        assert!(team_for_seat(t, 0).is_err());
    }

    #[test]
    fn both_teams_start_at_two() {
        let levels = TeamLevels::default();
        assert_eq!(levels.level_for(Team::A), Rank::Two);
        assert_eq!(levels.level_for(Team::B), Rank::Two);
        assert!(!levels.wins_match(Team::A));
        assert!(!levels.wins_match(Team::B));
    }

    #[test]
    fn winning_team_can_advance_multiple_levels() {
        let mut levels = TeamLevels::default();
        assert_eq!(levels.advance_winner_by(Team::A, 3), Rank::Five);
        assert_eq!(levels.team_b, Rank::Two);
        assert_eq!(levels.advance_winner_by(Team::B, 2), Rank::Four);
    }

    #[test]
    fn promotion_steps_follow_standard_four_player_finish_order() {
        let t = TableConfig::new(4).unwrap();
        assert_eq!(four_player_promotion_steps(t, &[0, 2]).unwrap(), 3);
        assert_eq!(four_player_promotion_steps(t, &[0, 1, 2]).unwrap(), 2);
        assert_eq!(four_player_promotion_steps(t, &[0, 1, 3]).unwrap(), 1);
    }

    #[test]
    fn one_four_finish_advances_exactly_one_level() {
        let t = TableConfig::new(4).unwrap();
        let finish_order = [0, 1, 3];
        let steps = four_player_promotion_steps(t, &finish_order).unwrap();
        assert_eq!(steps, 1);

        let mut levels = TeamLevels::default();
        assert_eq!(levels.advance_winner_by(Team::A, steps), Rank::Three);
        assert_eq!(levels.team_a, Rank::Three);
        assert_eq!(levels.team_b, Rank::Two);
    }

    #[test]
    fn ace_requires_partner_not_last() {
        let t = TableConfig::new(4).unwrap();
        assert!(four_player_ace_win(t, &[0, 2]).unwrap());
        assert!(four_player_ace_win(t, &[0, 1, 2]).unwrap());
        assert!(!four_player_ace_win(t, &[0, 1, 3]).unwrap());
    }

    #[test]
    fn reaching_ace_does_not_end_match_until_ace_is_won() {
        let mut levels = TeamLevels {
            team_a: Rank::King,
            team_b: Rank::Two,
        };
        assert!(!levels.wins_match(Team::A));
        assert_eq!(levels.advance_winner(Team::A), Rank::Ace);
        assert!(levels.wins_match(Team::A));
    }

    #[test]
    fn repeated_wins_progress_from_two_to_ace() {
        let mut levels = TeamLevels::default();
        for expected in [
            Rank::Three,
            Rank::Four,
            Rank::Five,
            Rank::Six,
            Rank::Seven,
            Rank::Eight,
            Rank::Nine,
            Rank::Ten,
            Rank::Jack,
            Rank::Queen,
            Rank::King,
            Rank::Ace,
        ] {
            assert_eq!(levels.advance_winner(Team::A), expected);
        }
        assert!(levels.wins_match(Team::A));
        assert_eq!(levels.advance_winner(Team::A), Rank::Ace);
        assert_eq!(levels.team_b, Rank::Two);
    }
}
