//! Guandan adapter for the backend's shared versioned-room architecture.
//!
//! The rule state is deliberately separate from websocket transport so the
//! Guandan game can migrate onto the same storage/subscription machinery used
//! by Shengji and Find Friends.

use serde::{Deserialize, Serialize};

use crate::serving_types::VersionedRoom;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct GuandanGameState {
    pub started: bool,
    pub player_names: Vec<String>,
    pub hands: Vec<Vec<usize>>,
    pub turn: usize,
    pub last_play: Vec<usize>,
    pub last_player: Option<usize>,
    pub passes: usize,
}

impl GuandanGameState {
    pub fn hand_counts(&self) -> Vec<usize> {
        self.hands.iter().map(Vec::len).collect()
    }

    /// Produce the private hand payload for one seat. Public table state is
    /// broadcast separately; another player's cards are never returned here.
    pub fn private_hand(&self, seat: usize) -> Option<&[usize]> {
        self.hands.get(seat).map(Vec::as_slice)
    }
}

pub type VersionedGuandanGame = VersionedRoom<GuandanGameState>;

pub fn new_guandan_room(room_name: Vec<u8>) -> VersionedGuandanGame {
    VersionedRoom::with_game(room_name, GuandanGameState::default())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn guandan_uses_shared_versioned_room() {
        let room = new_guandan_room(b"test-room".to_vec());
        assert_eq!(room.monotonic_id, 0);
        assert!(!room.game.started);
        assert!(room.associated_websockets.is_empty());
    }

    #[test]
    fn private_hand_does_not_expose_other_seats() {
        let mut state = GuandanGameState::default();
        state.hands = vec![vec![1, 2], vec![3, 4]];
        assert_eq!(state.private_hand(0), Some(&[1, 2][..]));
        assert_eq!(state.private_hand(1), Some(&[3, 4][..]));
        assert_eq!(state.private_hand(2), None);
    }
}
