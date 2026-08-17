//! Isolated Guandan websocket protocol for the desktop multiplayer test.

use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use shengji_core::guandan::{deck::CARDS_PER_PLAYER, TableConfig, MAX_PLAYERS, MIN_PLAYERS};
use tokio::sync::{mpsc, Mutex};

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GuandanClientMessage {
    Join { room: String, name: String },
    Start { player_count: usize },
    Play { card_indexes: Vec<usize> },
    Pass,
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GuandanServerMessage {
    Connected { protocol: &'static str },
    Joined { room: String, seat: usize },
    Waiting { players: Vec<String>, minimum_players: usize, maximum_players: usize },
    Started { player_count: usize, cards_per_player: usize },
    Error { message: String },
}

struct RoomMember {
    name: String,
    tx: mpsc::UnboundedSender<String>,
}

#[derive(Default)]
struct Room {
    members: Vec<RoomMember>,
}

type Rooms = Arc<Mutex<HashMap<String, Room>>>;

lazy_static::lazy_static! {
    static ref ROOMS: Rooms = Arc::new(Mutex::new(HashMap::new()));
}

pub fn validate_start(player_count: usize) -> Result<TableConfig, &'static str> {
    let table = TableConfig::new(player_count)?;
    if !table.is_even_table() {
        return Err("first multiplayer test supports even tables: 4, 6, 8, 10, 12, 14");
    }
    Ok(table)
}

fn encode(message: &GuandanServerMessage) -> Option<String> {
    serde_json::to_string(message).ok()
}

async fn broadcast_waiting(room_name: &str) {
    let rooms = ROOMS.lock().await;
    if let Some(room) = rooms.get(room_name) {
        let players = room.members.iter().map(|member| member.name.clone()).collect::<Vec<_>>();
        if let Some(text) = encode(&GuandanServerMessage::Waiting {
            players,
            minimum_players: MIN_PLAYERS,
            maximum_players: MAX_PLAYERS,
        }) {
            for member in &room.members {
                let _ = member.tx.send(text.clone());
            }
        }
    }
}

async fn broadcast(room_name: &str, message: GuandanServerMessage) {
    let rooms = ROOMS.lock().await;
    if let (Some(room), Some(text)) = (rooms.get(room_name), encode(&message)) {
        for member in &room.members {
            let _ = member.tx.send(text.clone());
        }
    }
}

pub async fn websocket(socket: WebSocket) {
    let (mut ws_tx, mut ws_rx) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    let writer = tokio::spawn(async move {
        while let Some(text) = rx.recv().await {
            if ws_tx.send(Message::Text(text)).await.is_err() {
                break;
            }
        }
    });

    if let Some(text) = encode(&GuandanServerMessage::Connected { protocol: "guandan-v2" }) {
        let _ = tx.send(text);
    }

    let mut joined_room: Option<String> = None;
    let mut joined_seat: Option<usize> = None;

    while let Some(result) = ws_rx.next().await {
        let message = match result {
            Ok(message) => message,
            Err(_) => break,
        };
        let text = match message {
            Message::Text(text) => text,
            Message::Binary(bytes) => match String::from_utf8(bytes) {
                Ok(text) => text,
                Err(_) => continue,
            },
            Message::Close(_) => break,
            Message::Ping(_) | Message::Pong(_) => continue,
        };
        let command = match serde_json::from_str::<GuandanClientMessage>(&text) {
            Ok(command) => command,
            Err(_) => {
                if let Some(text) = encode(&GuandanServerMessage::Error { message: "invalid guandan command".to_string() }) {
                    let _ = tx.send(text);
                }
                continue;
            }
        };

        match command {
            GuandanClientMessage::Join { room, name } => {
                if joined_room.is_some() {
                    if let Some(text) = encode(&GuandanServerMessage::Error { message: "already joined a guandan room".to_string() }) {
                        let _ = tx.send(text);
                    }
                    continue;
                }
                let seat = {
                    let mut rooms = ROOMS.lock().await;
                    let room_state = rooms.entry(room.clone()).or_default();
                    if room_state.members.len() >= MAX_PLAYERS {
                        None
                    } else {
                        let seat = room_state.members.len();
                        room_state.members.push(RoomMember { name, tx: tx.clone() });
                        Some(seat)
                    }
                };
                match seat {
                    Some(seat) => {
                        joined_room = Some(room.clone());
                        joined_seat = Some(seat);
                        if let Some(text) = encode(&GuandanServerMessage::Joined { room: room.clone(), seat }) {
                            let _ = tx.send(text);
                        }
                        broadcast_waiting(&room).await;
                    }
                    None => {
                        if let Some(text) = encode(&GuandanServerMessage::Error { message: "room is full".to_string() }) {
                            let _ = tx.send(text);
                        }
                    }
                }
            }
            GuandanClientMessage::Start { player_count } => {
                let room_name = match joined_room.as_deref() {
                    Some(room_name) => room_name,
                    None => {
                        if let Some(text) = encode(&GuandanServerMessage::Error { message: "join a room before starting".to_string() }) {
                            let _ = tx.send(text);
                        }
                        continue;
                    }
                };
                let table = match validate_start(player_count) {
                    Ok(table) => table,
                    Err(error) => {
                        if let Some(text) = encode(&GuandanServerMessage::Error { message: error.to_string() }) {
                            let _ = tx.send(text);
                        }
                        continue;
                    }
                };
                let current_players = {
                    let rooms = ROOMS.lock().await;
                    rooms.get(room_name).map(|room| room.members.len()).unwrap_or(0)
                };
                if current_players != table.player_count {
                    if let Some(text) = encode(&GuandanServerMessage::Error {
                        message: format!("need exactly {} players; currently {}", table.player_count, current_players),
                    }) {
                        let _ = tx.send(text);
                    }
                    continue;
                }
                broadcast(room_name, GuandanServerMessage::Started {
                    player_count: table.player_count,
                    cards_per_player: CARDS_PER_PLAYER,
                }).await;
            }
            GuandanClientMessage::Play { card_indexes } => {
                let selected_count = card_indexes.len();
                if let Some(text) = encode(&GuandanServerMessage::Error {
                    message: format!("play received ({} cards); dealing/play sync is next", selected_count),
                }) {
                    let _ = tx.send(text);
                }
            }
            GuandanClientMessage::Pass => {
                if let Some(room_name) = joined_room.as_deref() {
                    broadcast_waiting(room_name).await;
                } else if let Some(text) = encode(&GuandanServerMessage::Error { message: "join a room before passing".to_string() }) {
                    let _ = tx.send(text);
                }
            }
        }
    }

    if let (Some(room_name), Some(seat)) = (joined_room, joined_seat) {
        {
            let mut rooms = ROOMS.lock().await;
            if let Some(room) = rooms.get_mut(&room_name) {
                if seat < room.members.len() {
                    room.members.remove(seat);
                }
                if room.members.is_empty() {
                    rooms.remove(&room_name);
                }
            }
        }
        broadcast_waiting(&room_name).await;
    }

    writer.abort();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_even_test_tables() {
        for count in [4usize, 6, 8, 10, 12, 14] {
            assert_eq!(validate_start(count).unwrap().player_count, count);
        }
    }

    #[test]
    fn rejects_odd_tables_for_first_network_test() {
        for count in [5usize, 7, 9, 11, 13] {
            assert!(validate_start(count).is_err());
        }
    }
}
