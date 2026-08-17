//! Team layout and level progression for multiplayer Guandan.
//!
//! Even tables use two alternating teams around the table, matching the
//! familiar partner-opposite/alternating seating idea while scaling to 14.
//! Each team keeps its own level and advances one step after winning a game.

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

    /// Winning while already playing Ace ends the whole match. Reaching Ace
    /// from King only advances the team to Ace; that team must then win an Ace
    /// game to become the final match winner.
    pub fn wins_match(self, winner: Team) -> bool {
        self.level_for(winner) == Rank::Ace
    }

    /// Advance exactly the winning team by one level. The losing team's level
    /// is unchanged. Ace remains terminal via `next_level`.
    pub fn advance_winner(&mut self, winner: Team) -> Rank {
        let level = match winner {
            Team::A => &mut self.team_a,
            Team::B => &mut self.team_b,
        };
        *level = next_level(*level);
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
    fn only_winning_team_advances() {
        let mut levels = TeamLevels::default();
        assert_eq!(levels.advance_winner(Team::A), Rank::Three);
        assert_eq!(levels.team_a, Rank::Three);
        assert_eq!(levels.team_b, Rank::Two);

        assert_eq!(levels.advance_winner(Team::B), Rank::Three);
        assert_eq!(levels.team_a, Rank::Three);
        assert_eq!(levels.team_b, Rank::Three);
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