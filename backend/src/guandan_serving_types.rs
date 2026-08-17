//! Guandan adapter for the backend's shared versioned-room architecture.
//!
//! The rule state is deliberately separate from websocket transport so the
//! Guandan game can migrate onto the same storage/subscription machinery used
//! by Shengji and Find Friends.

use serde::{Deserialize, Serialize};
use shengji_core::guandan::CardFace;
use storage::State;

use crate::serving_types::VersionedRoom;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct GuandanGameState {
    pub started: bool,
    pub player_names: Vec<String>,
    pub hands: Vec<Vec<CardFace>>,
    pub turn: usize,
    pub last_play: Vec<CardFace>,
    pub last_player: Option<usize>,
    pub passes: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum GuandanStorageMessage {
    StateChanged,
}

impl GuandanGameState {
    pub fn hand_counts(&self) -> Vec<usize> {
        self.hands.iter().map(Vec::len).collect()
    }

    /// Produce the private hand payload for one seat. Public table state is
    /// broadcast separately; another player's cards are never returned here.
    pub fn private_hand(&self, seat: usize) -> Option<&[CardFace]> {
        self.hands.get(seat).map(Vec::as_slice)
    }
}

pub type VersionedGuandanGame = VersionedRoom<GuandanGameState>;

impl State for VersionedGuandanGame {
    type Message = GuandanStorageMessage;

    fn version(&self) -> u64 {
        self.monotonic_id
    }

    fn key(&self) -> &[u8] {
        &self.room_name
    }

    fn new_from_key(key: Vec<u8>) -> Self {
        new_guandan_room(key)
    }
}

pub fn new_guandan_room(room_name: Vec<u8>) -> VersionedGuandanGame {
    VersionedRoom::with_game(room_name, GuandanGameState::default())
}

#[cfg(test)]
mod tests {
    use super::*;
    use shengji_core::guandan::{Rank, Suit};

    #[test]
    fn guandan_uses_shared_versioned_room() {
        let room = new_guandan_room(b"test-room".to_vec());
        assert_eq!(room.monotonic_id, 0);
        assert!(!room.game.started);
        assert!(room.associated_websockets.is_empty());
        assert_eq!(room.key(), b"test-room");
    }

    #[test]
    fn private_hand_does_not_expose_other_seats() {
        let c1 = CardFace::Suited { suit: Suit::Clubs, rank: Rank::Two };
        let c2 = CardFace::Suited { suit: Suit::Hearts, rank: Rank::Ace };
        let mut state = GuandanGameState::default();
        state.hands = vec![vec![c1], vec![c2]];
        assert_eq!(state.private_hand(0), Some(&[c1][..]));
        assert_eq!(state.private_hand(1), Some(&[c2][..]));
        assert_eq!(state.private_hand(2), None);
    }
}
