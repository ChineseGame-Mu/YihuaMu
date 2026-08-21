//! Turn/trick state for the Guandan multiplayer table.
//!
//! Kept independent from Shengji so the existing games are unaffected.

use super::TableConfig;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TrickState {
    player_count: usize,
    current_player: usize,
    leader: usize,
    last_play_player: Option<usize>,
    passed: Vec<bool>,
    finished: Vec<bool>,
}

impl TrickState {
    pub fn new(table: TableConfig, leader: usize) -> Result<Self, &'static str> {
        if leader >= table.player_count {
            return Err("leader seat is outside the table");
        }
        Ok(Self {
            player_count: table.player_count,
            current_player: leader,
            leader,
            last_play_player: None,
            passed: vec![false; table.player_count],
            finished: vec![false; table.player_count],
        })
    }

    pub fn current_player(&self) -> usize {
        self.current_player
    }

    pub fn leader(&self) -> usize {
        self.leader
    }

    pub fn mark_play(&mut self, player: usize) -> Result<(), &'static str> {
        self.ensure_turn(player)?;
        self.last_play_player = Some(player);
        self.leader = player;
        self.passed.fill(false);
        self.advance();
        Ok(())
    }

    pub fn pass(&mut self, player: usize) -> Result<bool, &'static str> {
        self.ensure_turn(player)?;
        if self.last_play_player.is_none() {
            return Err("leader cannot pass before a play");
        }
        self.passed[player] = true;
        self.advance();
        let trick_closed = self.active_opponents_of_leader_have_passed();
        if trick_closed {
            self.current_player = self.leader;
            self.last_play_player = None;
            self.passed.fill(false);
            if self.finished[self.current_player] {
                self.advance();
            }
        }
        Ok(trick_closed)
    }

    pub fn finish_player(&mut self, player: usize) -> Result<(), &'static str> {
        if player >= self.player_count {
            return Err("player seat is outside the table");
        }
        self.finished[player] = true;
        if self.current_player == player {
            self.advance();
        }
        Ok(())
    }

    fn ensure_turn(&self, player: usize) -> Result<(), &'static str> {
        if player >= self.player_count {
            return Err("player seat is outside the table");
        }
        if self.finished[player] {
            return Err("finished player cannot act");
        }
        if self.current_player != player {
            return Err("not this player's turn");
        }
        Ok(())
    }

    fn advance(&mut self) {
        for offset in 1..=self.player_count {
            let candidate = (self.current_player + offset) % self.player_count;
            if !self.finished[candidate] {
                self.current_player = candidate;
                return;
            }
        }
    }

    fn active_opponents_of_leader_have_passed(&self) -> bool {
        (0..self.player_count)
            .filter(|seat| *seat != self.leader && !self.finished[*seat])
            .all(|seat| self.passed[seat])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn four_player_trick_returns_to_last_player_after_three_passes() {
        let table = TableConfig::new(4).unwrap();
        let mut trick = TrickState::new(table, 0).unwrap();
        trick.mark_play(0).unwrap();
        assert_eq!(trick.current_player(), 1);
        assert!(!trick.pass(1).unwrap());
        assert!(!trick.pass(2).unwrap());
        assert!(trick.pass(3).unwrap());
        assert_eq!(trick.current_player(), 0);
    }

    #[test]
    fn finished_trick_winner_is_skipped_after_other_players_pass() {
        let table = TableConfig::new(4).unwrap();
        let mut trick = TrickState::new(table, 0).unwrap();
        trick.mark_play(0).unwrap();
        trick.finish_player(0).unwrap();

        assert!(!trick.pass(1).unwrap());
        assert!(!trick.pass(2).unwrap());
        assert!(trick.pass(3).unwrap());
        assert_eq!(trick.current_player(), 1);
    }

    #[test]
    fn fourteen_player_rotation_is_supported() {
        let table = TableConfig::new(14).unwrap();
        let mut trick = TrickState::new(table, 13).unwrap();
        trick.mark_play(13).unwrap();
        assert_eq!(trick.current_player(), 0);
    }

    #[test]
    fn finished_players_are_skipped() {
        let table = TableConfig::new(6).unwrap();
        let mut trick = TrickState::new(table, 0).unwrap();
        trick.finish_player(1).unwrap();
        trick.mark_play(0).unwrap();
        assert_eq!(trick.current_player(), 2);
    }

    #[test]
    fn leader_cannot_pass_without_opening_play() {
        let table = TableConfig::new(4).unwrap();
        let mut trick = TrickState::new(table, 0).unwrap();
        assert!(trick.pass(0).is_err());
    }
}
