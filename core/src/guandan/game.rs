//! Minimal playable-round state used by the first desktop multiplayer test.

use super::trick::TrickState;
use super::{
    deck::{build_deck, deal},
    CardFace, TableConfig,
};

#[derive(Clone, Debug)]
pub struct RoundState {
    pub table: TableConfig,
    pub hands: Vec<Vec<CardFace>>,
    pub finish_order: Vec<usize>,
    pub trick: TrickState,
}

impl RoundState {
    /// Starts from a deterministic deck. Production room code will shuffle
    /// before calling `from_deck`.
    pub fn new_unshuffled(table: TableConfig, leader: usize) -> Result<Self, &'static str> {
        Self::from_deck(table, leader, build_deck(table))
    }

    pub fn from_deck(
        table: TableConfig,
        leader: usize,
        deck: Vec<CardFace>,
    ) -> Result<Self, &'static str> {
        let (hands, _) = deal(table, &deck)?;
        Ok(Self {
            table,
            hands,
            finish_order: Vec::new(),
            trick: TrickState::new(table, leader)?,
        })
    }

    pub fn play_cards(
        &mut self,
        player: usize,
        mut indexes: Vec<usize>,
    ) -> Result<Vec<CardFace>, &'static str> {
        if player != self.trick.current_player() {
            return Err("not this player's turn");
        }
        if indexes.is_empty() {
            return Err("play must contain at least one card");
        }
        indexes.sort_unstable();
        indexes.dedup();
        if indexes
            .iter()
            .any(|index| *index >= self.hands[player].len())
        {
            return Err("card index is outside the hand");
        }

        let played = indexes
            .iter()
            .map(|index| self.hands[player][*index])
            .collect::<Vec<_>>();
        for index in indexes.into_iter().rev() {
            self.hands[player].remove(index);
        }
        self.trick.mark_play(player)?;

        if self.hands[player].is_empty() {
            self.finish_order.push(player);
            self.trick.finish_player(player)?;
        }
        Ok(played)
    }

    pub fn pass(&mut self, player: usize) -> Result<bool, &'static str> {
        self.trick.pass(player)
    }

    pub fn is_finished(&self) -> bool {
        self.finish_order.len() + 1 >= self.table.player_count
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_starts_with_twenty_seven_cards_per_player() {
        let state = RoundState::new_unshuffled(TableConfig::new(4).unwrap(), 0).unwrap();
        assert!(state.hands.iter().all(|hand| hand.len() == 27));
        assert_eq!(state.trick.current_player(), 0);
    }

    #[test]
    fn playing_removes_cards_and_advances_turn() {
        let mut state = RoundState::new_unshuffled(TableConfig::new(4).unwrap(), 0).unwrap();
        state.play_cards(0, vec![0]).unwrap();
        assert_eq!(state.hands[0].len(), 26);
        assert_eq!(state.trick.current_player(), 1);
    }

    #[test]
    fn supports_fourteen_player_round_state() {
        let state = RoundState::new_unshuffled(TableConfig::new(14).unwrap(), 13).unwrap();
        assert_eq!(state.hands.len(), 14);
        assert!(state.hands.iter().all(|hand| hand.len() == 27));
    }
}
