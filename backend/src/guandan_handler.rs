//! Guandan websocket protocol backed by the same HashMapStorage abstraction
//! used by the existing Shengji/Find-Friends server.

use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use rand::seq::SliceRandom;
use rand::thread_rng;
use serde::{Deserialize, Serialize};
use shengji_core::guandan::{
    deck::{build_deck, deal, CARDS_PER_PLAYER},
    rules::classify_basic,
    CardFace, TableConfig, MAX_PLAYERS, MIN_PLAYERS,
};
use storage::{HashMapStorage, Storage};
use tokio::sync::mpsc;

use crate::guandan_serving_types::{
    GuandanStorageMessage, GuandanTablePlay, VersionedGuandanGame,
};

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GuandanClientMessage {
    Join { room: String, name: String },
    Start { player_count: usize },
    Play { card_indexes: Vec<usize> },
    Pass,
    EndRound,
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GuandanServerMessage {
    Connected { protocol: &'static str },
    Joined { room: String, seat: usize },
    Waiting {
        players: Vec<String>,
        minimum_players: usize,
        maximum_players: usize,
    },
    Started {
        player_count: usize,
        cards_per_player: usize,
    },
    Hand { cards: Vec<CardFace> },
    State {
        players: Vec<String>,
        turn: usize,
        hand_counts: Vec<usize>,
        last_play: Vec<CardFace>,
        last_player: Option<usize>,
        table_plays: Vec<GuandanTablePlay>,
        passes: usize,
        trick_complete: bool,
    },
    Error { message: String },
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

fn send(tx: &mpsc::UnboundedSender<String>, message: &GuandanServerMessage) {
    if let Some(text) = encode(message) {
        let _ = tx.send(text);
    }
}

fn advance_turn(game: &mut crate::guandan_serving_types::GuandanGameState) {
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

fn state_message(game: &crate::guandan_serving_types::GuandanGameState) -> GuandanServerMessage {
    GuandanServerMessage::State {
        players: game.player_names.clone(),
        turn: game.turn,
        hand_counts: game.hand_counts(),
        last_play: game.last_play.clone(),
        last_player: game.last_player,
        table_plays: game.table_plays.clone(),
        passes: game.passes,
        trick_complete: game.trick_complete,
    }
}

fn basic_play_is_legal(cards: &[CardFace]) -> bool {
    classify_basic(cards).is_some()
}

pub async fn websocket(
    socket: WebSocket,
    storage: HashMapStorage<VersionedGuandanGame>,
    subscriber_id: usize,
) {
    let (mut ws_tx, mut ws_rx) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();
    let writer = tokio::spawn(async move {
        while let Some(text) = rx.recv().await {
            if ws_tx.send(Message::Text(text)).await.is_err() {
                break;
            }
        }
    });

    send(
        &tx,
        &GuandanServerMessage::Connected {
            protocol: "guandan-v9-pattern-validation",
        },
    );
    let mut joined_room: Option<Vec<u8>> = None;
    let mut joined_seat: Option<usize> = None;
    let mut subscription_task = None;

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
                send(
                    &tx,
                    &GuandanServerMessage::Error {
                        message: "invalid guandan command".to_string(),
                    },
                );
                continue;
            }
        };

        match command {
            GuandanClientMessage::Join { room, name } => {
                if joined_room.is_some() {
                    send(
                        &tx,
                        &GuandanServerMessage::Error {
                            message: "already joined a guandan room".to_string(),
                        },
                    );
                    continue;
                }
                let key = room.as_bytes().to_vec();
                let name_for_state = name.clone();
                let seat_result = storage
                    .clone()
                    .execute_operation_with_messages(key.clone(), move |mut state| {
                        if state.game.started || state.game.player_names.len() >= MAX_PLAYERS {
                            return Err(());
                        }
                        state.game.player_names.push(name_for_state);
                        state.bump_version();
                        Ok((state, vec![GuandanStorageMessage::StateChanged]))
                    })
                    .await;
                let seat = match seat_result {
                    Ok(_) => {
                        let state = match storage.clone().get(key.clone()).await {
                            Ok(s) => s,
                            Err(_) => continue,
                        };
                        state
                            .game
                            .player_names
                            .iter()
                            .position(|n| n == &name)
                            .unwrap_or(state.game.player_names.len().saturating_sub(1))
                    }
                    Err(_) => {
                        send(
                            &tx,
                            &GuandanServerMessage::Error {
                                message: "room is full or game already started".to_string(),
                            },
                        );
                        continue;
                    }
                };
                joined_room = Some(key.clone());
                joined_seat = Some(seat);
                send(&tx, &GuandanServerMessage::Joined { room, seat });
                let state = storage.clone().get(key.clone()).await.unwrap();
                send(
                    &tx,
                    &GuandanServerMessage::Waiting {
                        players: state.game.player_names.clone(),
                        minimum_players: MIN_PLAYERS,
                        maximum_players: MAX_PLAYERS,
                    },
                );
                let mut sub = storage
                    .clone()
                    .subscribe(key.clone(), subscriber_id)
                    .await
                    .unwrap();
                let tx_sub = tx.clone();
                let storage_sub = storage.clone();
                let seat_sub = seat;
                subscription_task = Some(tokio::spawn(async move {
                    while sub.recv().await.is_some() {
                        if let Ok(state) = storage_sub.clone().get(key.clone()).await {
                            if state.game.started {
                                send(&tx_sub, &state_message(&state.game));
                                if let Some(hand) = state.game.private_hand(seat_sub) {
                                    send(
                                        &tx_sub,
                                        &GuandanServerMessage::Hand {
                                            cards: hand.to_vec(),
                                        },
                                    );
                                }
                            } else {
                                send(
                                    &tx_sub,
                                    &GuandanServerMessage::Waiting {
                                        players: state.game.player_names.clone(),
                                        minimum_players: MIN_PLAYERS,
                                        maximum_players: MAX_PLAYERS,
                                    },
                                );
                            }
                        }
                    }
                }));
            }
            GuandanClientMessage::Start { player_count } => {
                let (key, seat) = match (joined_room.clone(), joined_seat) {
                    (Some(k), Some(s)) => (k, s),
                    _ => {
                        send(
                            &tx,
                            &GuandanServerMessage::Error {
                                message: "join a room before starting".to_string(),
                            },
                        );
                        continue;
                    }
                };
                if seat != 0 {
                    send(
                        &tx,
                        &GuandanServerMessage::Error {
                            message: "only seat 1 can start the game".to_string(),
                        },
                    );
                    continue;
                }
                let table = match validate_start(player_count) {
                    Ok(t) => t,
                    Err(e) => {
                        send(
                            &tx,
                            &GuandanServerMessage::Error {
                                message: e.to_string(),
                            },
                        );
                        continue;
                    }
                };
                let result = storage
                    .clone()
                    .execute_operation_with_messages(key.clone(), move |mut state| {
                        if state.game.player_names.len() != table.player_count {
                            return Err(());
                        }
                        let mut deck = build_deck(table);
                        deck.shuffle(&mut thread_rng());
                        let (hands, remainder) = deal(table, &deck).map_err(|_| ())?;
                        if !remainder.is_empty() {
                            return Err(());
                        }
                        state.game.started = true;
                        state.game.hands = hands;
                        state.game.turn = 0;
                        state.game.last_play.clear();
                        state.game.last_player = None;
                        state.game.table_plays.clear();
                        state.game.passes = 0;
                        state.game.trick_complete = false;
                        state.bump_version();
                        Ok((state, vec![GuandanStorageMessage::StateChanged]))
                    })
                    .await;
                if result.is_err() {
                    send(
                        &tx,
                        &GuandanServerMessage::Error {
                            message: "player count does not match room".to_string(),
                        },
                    );
                    continue;
                }
                let state = storage.clone().get(key).await.unwrap();
                send(
                    &tx,
                    &GuandanServerMessage::Started {
                        player_count,
                        cards_per_player: CARDS_PER_PLAYER,
                    },
                );
                if let Some(hand) = state.game.private_hand(seat) {
                    send(
                        &tx,
                        &GuandanServerMessage::Hand {
                            cards: hand.to_vec(),
                        },
                    );
                }
            }
            GuandanClientMessage::Play { mut card_indexes } => {
                let (key, seat) = match (joined_room.clone(), joined_seat) {
                    (Some(k), Some(s)) => (k, s),
                    _ => continue,
                };
                card_indexes.sort_unstable();
                card_indexes.dedup();
                let indexes = card_indexes.clone();
                let result = storage
                    .clone()
                    .execute_operation_with_messages(key.clone(), move |mut state| {
                        if !state.game.started
                            || state.game.trick_complete
                            || state.game.turn != seat
                            || indexes.is_empty()
                            || indexes.last().copied().unwrap_or(0)
                                >= state.game.hands[seat].len()
                        {
                            return Err("not your turn or invalid card selection");
                        }
                        let cards = indexes
                            .iter()
                            .map(|&i| state.game.hands[seat][i])
                            .collect::<Vec<_>>();
                        if !basic_play_is_legal(&cards) {
                            return Err("selected cards are not a legal Guandan pattern");
                        }
                        for &i in indexes.iter().rev() {
                            state.game.hands[seat].remove(i);
                        }
                        state.game.last_play = cards.clone();
                        state.game.last_player = Some(seat);
                        state.game.table_plays.push(GuandanTablePlay {
                            player: seat,
                            cards,
                        });
                        state.game.passes = 0;
                        advance_turn(&mut state.game);
                        state.bump_version();
                        Ok((state, vec![GuandanStorageMessage::StateChanged]))
                    })
                    .await;
                if let Err(message) = result {
                    send(
                        &tx,
                        &GuandanServerMessage::Error {
                            message: message.to_string(),
                        },
                    );
                    continue;
                }
                let state = storage.clone().get(key).await.unwrap();
                if let Some(hand) = state.game.private_hand(seat) {
                    send(
                        &tx,
                        &GuandanServerMessage::Hand {
                            cards: hand.to_vec(),
                        },
                    );
                }
            }
            GuandanClientMessage::Pass => {
                let (key, seat) = match (joined_room.clone(), joined_seat) {
                    (Some(k), Some(s)) => (k, s),
                    _ => continue,
                };
                let result = storage
                    .clone()
                    .execute_operation_with_messages(key, move |mut state| {
                        if !state.game.started
                            || state.game.trick_complete
                            || state.game.turn != seat
                            || state.game.last_player.is_none()
                        {
                            return Err(());
                        }
                        state.game.passes += 1;
                        let active = state.game.hands.iter().filter(|h| !h.is_empty()).count();
                        if state.game.passes + 1 >= active {
                            state.game.turn = state.game.last_player.unwrap();
                            state.game.trick_complete = true;
                        } else {
                            advance_turn(&mut state.game);
                        }
                        state.bump_version();
                        Ok((state, vec![GuandanStorageMessage::StateChanged]))
                    })
                    .await;
                if result.is_err() {
                    send(
                        &tx,
                        &GuandanServerMessage::Error {
                            message: "cannot pass now".to_string(),
                        },
                    );
                }
            }
            GuandanClientMessage::EndRound => {
                let key = match joined_room.clone() {
                    Some(k) => k,
                    None => continue,
                };
                let result = storage
                    .clone()
                    .execute_operation_with_messages(key, move |mut state| {
                        if !state.game.started || !state.game.trick_complete {
                            return Err(());
                        }
                        let winner = state.game.last_player.ok_or(())?;
                        state.game.turn = winner;
                        state.game.last_play.clear();
                        state.game.last_player = None;
                        state.game.table_plays.clear();
                        state.game.passes = 0;
                        state.game.trick_complete = false;
                        state.bump_version();
                        Ok((state, vec![GuandanStorageMessage::StateChanged]))
                    })
                    .await;
                if result.is_err() {
                    send(
                        &tx,
                        &GuandanServerMessage::Error {
                            message: "round is not ready to end".to_string(),
                        },
                    );
                }
            }
        }
    }

    if let Some(key) = joined_room {
        storage.unsubscribe(key, subscriber_id).await;
    }
    if let Some(task) = subscription_task {
        task.abort();
    }
    writer.abort();
}

#[cfg(test)]
mod tests {
    use super::*;
    use shengji_core::guandan::{Rank, Suit};

    fn card(suit: Suit, rank: Rank) -> CardFace {
        CardFace::Suited { suit, rank }
    }

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

    #[test]
    fn accepts_basic_legal_play_patterns() {
        assert!(basic_play_is_legal(&[card(Suit::Spades, Rank::Ace)]));
        assert!(basic_play_is_legal(&[
            card(Suit::Clubs, Rank::King),
            card(Suit::Hearts, Rank::King),
        ]));
        assert!(basic_play_is_legal(&[
            card(Suit::Clubs, Rank::Nine),
            card(Suit::Diamonds, Rank::Nine),
            card(Suit::Hearts, Rank::Nine),
            card(Suit::Spades, Rank::Nine),
        ]));
    }

    #[test]
    fn rejects_mixed_cards_that_are_not_a_guandan_pattern() {
        assert!(!basic_play_is_legal(&[
            card(Suit::Clubs, Rank::Three),
            card(Suit::Hearts, Rank::Eight),
        ]));
    }
}
