use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use shengji_core::interactive::Action;
use shengji_mechanics::types::{CardInfo, PlayerID};
use shengji_types::GameMessage;
use storage::State;

/// Shared versioned-room shape used by the existing Shengji/Find-Friends
/// backend and by new game adapters such as Guandan.  Keeping the room key,
/// websocket ownership and monotonic version outside the game rules lets
/// multiple games reuse the same storage/subscription architecture.
#[derive(Serialize, Deserialize, Clone)]
pub struct VersionedRoom<G> {
    pub(crate) room_name: Vec<u8>,
    pub(crate) game: G,
    pub(crate) associated_websockets: HashMap<PlayerID, Vec<usize>>,
    pub(crate) monotonic_id: u64,
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
        VersionedRoom {
            room_name: key,
            game: shengji_core::game_state::GameState::Initialize(
                shengji_core::game_state::initialize_phase::InitializePhase::new(),
            ),
            associated_websockets: HashMap::new(),
            monotonic_id: 0,
        }
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
