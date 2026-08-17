//! Team layout for the first multiplayer Guandan test milestone.
//!
//! Even tables use two alternating teams around the table, matching the
//! familiar partner-opposite/alternating seating idea while scaling to 14.

use super::TableConfig;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Team { A, B }

pub fn team_for_seat(table: TableConfig, seat: usize) -> Result<Team, &'static str> {
    if seat >= table.player_count { return Err("seat is outside the table"); }
    if !table.is_even_table() { return Err("team mode requires an even player count"); }
    Ok(if seat.is_multiple_of(2) { Team::A } else { Team::B })
}

pub fn teammates(table: TableConfig, seat: usize) -> Result<Vec<usize>, &'static str> {
    let team = team_for_seat(table, seat)?;
    Ok(table.seat_numbers().filter(|other| *other != seat && team_for_seat(table, *other).ok() == Some(team)).collect())
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
}
