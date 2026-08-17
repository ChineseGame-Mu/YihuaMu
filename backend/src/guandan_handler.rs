//! Isolated Guandan websocket protocol for the desktop multiplayer test.

use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use rand::seq::SliceRandom;
use rand::thread_rng;
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
    Hand { cards: Vec<usize> },
    State { turn: usize, hand_counts: Vec<usize>, last_play: Vec<usize>, last_player: Option<usize>, passes: usize },
    Played { seat: usize, cards: Vec<usize> },
    Passed { seat: usize },
    Error { message: String },
}

struct RoomMember {
    name: String,
    tx: mpsc::UnboundedSender<String>,
}

#[derive(Clone, Default)]
struct GameState {
    started: bool,
    hands: Vec<Vec<usize>>,
    turn: usize,
    last_play: Vec<usize>,
    last_player: Option<usize>,
    passes: usize,
}

#[derive(Default)]
struct Room {
    members: Vec<RoomMember>,
    game: GameState,
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

fn send(member: &RoomMember, message: &GuandanServerMessage) {
    if let Some(text) = encode(message) {
        let _ = member.tx.send(text);
    }
}

fn broadcast_locked(room: &Room, message: &GuandanServerMessage) {
    if let Some(text) = encode(message) {
        for member in &room.members {
            let _ = member.tx.send(text.clone());
        }
    }
}

fn broadcast_state_locked(room: &Room) {
    if !room.game.started {
        return;
    }
    let state = GuandanServerMessage::State {
        turn: room.game.turn,
        hand_counts: room.game.hands.iter().map(Vec::len).collect(),
        last_play: room.game.last_play.clone(),
        last_player: room.game.last_player,
        passes: room.game.passes,
    };
    broadcast_locked(room, &state);
}

async fn broadcast_waiting(room_name: &str) {
    let rooms = ROOMS.lock().await;
    if let Some(room) = rooms.get(room_name) {
        let players = room.members.iter().map(|member| member.name.clone()).collect::<Vec<_>>();
        broadcast_locked(room, &GuandanServerMessage::Waiting {
            players,
            minimum_players: MIN_PLAYERS,
            maximum_players: MAX_PLAYERS,
        });
    }
}

fn advance_turn(game: &mut GameState) {
    if game.hands.is_empty() {
        return;
    }
    for _ in 0..game.hands.len() {
        game.turn = (game.turn + 1) % game.hands.len();
        if !game.hands[game.turn].is_empty() {
            break;
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

    if let Some(text) = encode(&GuandanServerMessage::Connected { protocol: "guandan-v3" }) {
        let _ = tx.send(text);
    }

    let mut joined_room: Option<String> = None;
    let mut joined_seat: Option<usize> = None;

    while let Some(result) = ws_rx.next().await {
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
                if let Some(text) = encode(&GuandanServerMessage::Error { message: "invalid guandan command".to_string() }) { let _ = tx.send(text); }
                continue;
            }
        };

        match command {
            GuandanClientMessage::Join { room, name } => {
                if joined_room.is_some() {
                    if let Some(text) = encode(&GuandanServerMessage::Error { message: "already joined a guandan room".to_string() }) { let _ = tx.send(text); }
                    continue;
                }
                let seat = {
                    let mut rooms = ROOMS.lock().await;
                    let room_state = rooms.entry(room.clone()).or_default();
                    if room_state.game.started || room_state.members.len() >= MAX_PLAYERS { None } else {
                        let seat = room_state.members.len();
                        room_state.members.push(RoomMember { name, tx: tx.clone() });
                        Some(seat)
                    }
                };
                match seat {
                    Some(seat) => {
                        joined_room = Some(room.clone());
                        joined_seat = Some(seat);
                        if let Some(text) = encode(&GuandanServerMessage::Joined { room: room.clone(), seat }) { let _ = tx.send(text); }
                        broadcast_waiting(&room).await;
                    }
                    None => if let Some(text) = encode(&GuandanServerMessage::Error { message: "room is full or game already started".to_string() }) { let _ = tx.send(text); },
                }
            }
            GuandanClientMessage::Start { player_count } => {
                let (room_name, seat) = match (joined_room.as_deref(), joined_seat) {
                    (Some(room_name), Some(seat)) => (room_name, seat),
                    _ => { if let Some(text) = encode(&GuandanServerMessage::Error { message: "join a room before starting".to_string() }) { let _ = tx.send(text); } continue; }
                };
                if seat != 0 {
                    if let Some(text) = encode(&GuandanServerMessage::Error { message: "only seat 1 can start the game".to_string() }) { let _ = tx.send(text); }
                    continue;
                }
                let table = match validate_start(player_count) {
                    Ok(table) => table,
                    Err(error) => { if let Some(text) = encode(&GuandanServerMessage::Error { message: error.to_string() }) { let _ = tx.send(text); } continue; }
                };
                let mut rooms = ROOMS.lock().await;
                let room = match rooms.get_mut(room_name) { Some(room) => room, None => continue };
                if room.members.len() != table.player_count {
                    send(&room.members[seat], &GuandanServerMessage::Error { message: format!("need exactly {} players; currently {}", table.player_count, room.members.len()) });
                    continue;
                }
                let total_cards = table.player_count * CARDS_PER_PLAYER;
                let mut deck: Vec<usize> = (0..total_cards).collect();
                deck.shuffle(&mut thread_rng());
                let mut hands = vec![Vec::with_capacity(CARDS_PER_PLAYER); table.player_count];
                for (index, card) in deck.into_iter().enumerate() { hands[index % table.player_count].push(card); }
                for hand in &mut hands { hand.sort_unstable(); }
                room.game = GameState { started: true, hands, turn: 0, last_play: Vec::new(), last_player: None, passes: 0 };
                broadcast_locked(room, &GuandanServerMessage::Started { player_count: table.player_count, cards_per_player: CARDS_PER_PLAYER });
                for (member_seat, member) in room.members.iter().enumerate() {
                    send(member, &GuandanServerMessage::Hand { cards: room.game.hands[member_seat].clone() });
                }
                broadcast_state_locked(room);
            }
            GuandanClientMessage::Play { mut card_indexes } => {
                let (room_name, seat) = match (joined_room.as_deref(), joined_seat) {
                    (Some(room_name), Some(seat)) => (room_name, seat),
                    _ => continue,
                };
                let mut rooms = ROOMS.lock().await;
                let room = match rooms.get_mut(room_name) { Some(room) => room, None => continue };
                if !room.game.started { send(&room.members[seat], &GuandanServerMessage::Error { message: "game has not started".to_string() }); continue; }
                if room.game.turn != seat { send(&room.members[seat], &GuandanServerMessage::Error { message: "not your turn".to_string() }); continue; }
                if card_indexes.is_empty() { send(&room.members[seat], &GuandanServerMessage::Error { message: "select at least one card".to_string() }); continue; }
                card_indexes.sort_unstable(); card_indexes.dedup();
                if card_indexes.last().copied().unwrap_or(0) >= room.game.hands[seat].len() { send(&room.members[seat], &GuandanServerMessage::Error { message: "invalid card selection".to_string() }); continue; }
                let cards = card_indexes.iter().map(|&i| room.game.hands[seat][i]).collect::<Vec<_>>();
                for &i in card_indexes.iter().rev() { room.game.hands[seat].remove(i); }
                room.game.last_play = cards.clone();
                room.game.last_player = Some(seat);
                room.game.passes = 0;
                broadcast_locked(room, &GuandanServerMessage::Played { seat, cards });
                send(&room.members[seat], &GuandanServerMessage::Hand { cards: room.game.hands[seat].clone() });
                advance_turn(&mut room.game);
                broadcast_state_locked(room);
            }
            GuandanClientMessage::Pass => {
                let (room_name, seat) = match (joined_room.as_deref(), joined_seat) { (Some(room_name), Some(seat)) => (room_name, seat), _ => continue };
                let mut rooms = ROOMS.lock().await;
                let room = match rooms.get_mut(room_name) { Some(room) => room, None => continue };
                if !room.game.started { continue; }
                if room.game.turn != seat { send(&room.members[seat], &GuandanServerMessage::Error { message: "not your turn".to_string() }); continue; }
                if room.game.last_player.is_none() { send(&room.members[seat], &GuandanServerMessage::Error { message: "lead player cannot pass".to_string() }); continue; }
                room.game.passes += 1;
                broadcast_locked(room, &GuandanServerMessage::Passed { seat });
                let active = room.game.hands.iter().filter(|hand| !hand.is_empty()).count();
                if room.game.passes + 1 >= active {
                    if let Some(last) = room.game.last_player {
                        room.game.turn = last;
                    }
                    room.game.last_play.clear();
                    room.game.last_player = None;
                    room.game.passes = 0;
                } else {
                    advance_turn(&mut room.game);
                }
                broadcast_state_locked(room);
            }
        }
    }

    if let (Some(room_name), Some(seat)) = (joined_room, joined_seat) {
        let mut rooms = ROOMS.lock().await;
        if let Some(room) = rooms.get_mut(&room_name) {
            if !room.game.started && seat < room.members.len() { room.members.remove(seat); }
            if room.members.is_empty() { rooms.remove(&room_name); }
        }
    }

    writer.abort();
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
