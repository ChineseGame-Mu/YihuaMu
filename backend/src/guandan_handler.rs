//! Isolated Guandan websocket protocol for the desktop multiplayer test.

use axum::extract::ws::{Message, WebSocket};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use shengji_core::guandan::{deck::CARDS_PER_PLAYER, TableConfig, MAX_PLAYERS, MIN_PLAYERS};

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

pub fn validate_start(player_count: usize) -> Result<TableConfig, &'static str> {
    let table = TableConfig::new(player_count)?;
    if !table.is_even_table() { return Err("first multiplayer test supports even tables: 4, 6, 8, 10, 12, 14"); }
    Ok(table)
}

async fn send_json(socket: &mut WebSocket, message: GuandanServerMessage) -> Result<(), ()> {
    let text = serde_json::to_string(&message).map_err(|_| ())?;
    socket.send(Message::Text(text)).await.map_err(|_| ())
}

pub async fn websocket(mut socket: WebSocket) {
    if send_json(&mut socket, GuandanServerMessage::Connected { protocol: "guandan-v1" }).await.is_err() { return; }
    while let Some(result) = socket.next().await {
        let message = match result { Ok(message) => message, Err(_) => break };
        let text = match message {
            Message::Text(text) => text,
            Message::Binary(bytes) => match String::from_utf8(bytes) { Ok(text) => text, Err(_) => continue },
            Message::Close(_) => break,
            Message::Ping(_) | Message::Pong(_) => continue,
        };
        let command = match serde_json::from_str::<GuandanClientMessage>(&text) {
            Ok(command) => command,
            Err(_) => {
                let _ = send_json(&mut socket, GuandanServerMessage::Error { message: "invalid guandan command".to_string() }).await;
                continue;
            }
        };
        let response = match command {
            GuandanClientMessage::Join { room, name } => {
                let _ = name;
                GuandanServerMessage::Joined { room, seat: 0 }
            }
            GuandanClientMessage::Start { player_count } => match validate_start(player_count) {
                Ok(table) => GuandanServerMessage::Started { player_count: table.player_count, cards_per_player: CARDS_PER_PLAYER },
                Err(error) => GuandanServerMessage::Error { message: error.to_string() },
            },
            GuandanClientMessage::Play { card_indexes } => {
                let _selected_count = card_indexes.len();
                GuandanServerMessage::Error { message: "join a synchronized room before playing".to_string() }
            }
            GuandanClientMessage::Pass => GuandanServerMessage::Waiting {
                players: Vec::new(), minimum_players: MIN_PLAYERS, maximum_players: MAX_PLAYERS,
            },
        };
        if send_json(&mut socket, response).await.is_err() { break; }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_even_test_tables() {
        for count in [4usize, 6, 8, 10, 12, 14] { assert_eq!(validate_start(count).unwrap().player_count, count); }
    }
    #[test]
    fn rejects_odd_tables_for_first_network_test() {
        for count in [5usize, 7, 9, 11, 13] { assert!(validate_start(count).is_err()); }
    }
}
