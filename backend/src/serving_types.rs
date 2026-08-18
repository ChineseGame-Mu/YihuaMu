use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use shengji_core::interactive::Action;
use shengji_mechanics::types::{CardInfo, PlayerID};
use shengji_types::GameMessage;
use storage::State;

/// Shared versioned-room shape. Shengji/Find-Friends and Guandan can use the
/// same room identity, websocket ownership, versioning and storage machinery
/// while keeping their rule engines separate.
#[derive(Serialize, Deserialize, Clone)]
pub struct VersionedRoom<G> {
    pub(crate) room_name: Vec<u8>,
    pub(crate) game: G,
    pub(crate) associated_websockets: HashMap<PlayerID, Vec<usize>>,
    pub(crate) monotonic_id: u64,
}

impl<G> VersionedRoom<G> {
    pub(crate) fn with_game(room_name: Vec<u8>, game: G) -> Self {
        Self {
            room_name,
            game,
            associated_websockets: HashMap::new(),
            monotonic_id: 0,
        }
    }
}

pub type VersionedGame = VersionedRoom<shengji_core::game_state::GameState>;

impl State for VersionedGame {
    type Message = GameMessage;

    fn version(&self) -> u64 {
        self.monotonic_id
    }

    fn key(&self) -> &[u8] {
        &self.room_name
    }

    fn new_from_key(key: Vec<u8>) -> Self {
        VersionedRoom::with_game(
            key,
            shengji_core::game_state::GameState::Initialize(
                shengji_core::game_state::initialize_phase::InitializePhase::new(),
            ),
        )
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct JoinRoom {
    pub(crate) room_name: String,
    pub(crate) name: String,
    #[serde(default)]
    pub(crate) disable_compression: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum UserMessage {
    Message(String),
    Action(Action),
    Kick(PlayerID),
    Beep,
    ReadyCheck,
    Ready,
}

#[derive(Clone, Serialize)]
pub struct CardsBlob {
    pub cards: Vec<CardInfo>,
}
