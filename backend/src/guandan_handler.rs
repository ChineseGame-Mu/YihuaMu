//! Guandan websocket protocol backed by the same HashMapStorage abstraction
//! used by the existing Shengji/Find-Friends server.

use std::fmt;

use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use rand::seq::SliceRandom;
use rand::thread_rng;
use serde::{Deserialize, Serialize};
use shengji_core::guandan::{
    compare::beats_at_level,
    deck::{build_deck, deal, CARDS_PER_PLAYER},
    strength::strength_basic,
    team::{
        four_player_ace_win, four_player_promotion_steps, team_for_seat, Team, TeamLevels,
    },
    tribute::TributePlan,
    CardFace, Rank, TableConfig, MAX_PLAYERS, MIN_PLAYERS,
};
use storage::{HashMapStorage, Storage};
use tokio::sync::mpsc;

use crate::guandan_serving_types::{
    GuandanGameState, GuandanStorageMessage, GuandanTablePlay, VersionedGuandanGame,
};

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GuandanClientMessage {
    Join { room: String, name: String },
    Start { player_count: usize },
    Play { card_indexes: Vec<usize> },
    TributeCard { card_index: usize },
    ReturnTribute { card_index: usize },
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
        level: Rank,
        team_levels: TeamLevels,
        finish_order: Vec<usize>,
        last_game_winner: Option<usize>,
        last_game_winner_team: Option<Team>,
        pending_tribute: Option<TributePlan>,
        tribute_resisted: bool,
        match_winner: Option<Team>,
    },
    Error { message: String },
}

#[derive(Debug)]
enum PlayError {
    Storage,
    Invalid(&'static str),
}

impl From<()> for PlayError {
    fn from(_: ()) -> Self {
        Self::Storage
    }
}

impl fmt::Display for PlayError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Storage => write!(f, "temporary room storage error"),
            Self::Invalid(message) => write!(f, "{message}"),
        }
    }
}

pub fn validate_start(player_count: usize) -> Result<TableConfig, &'static str> {
    let table = TableConfig::new(player_count)?;
    if !table.is_even_table() {
        return Err("Guandan supports even tables: 4, 6, 8, 10, 12, 14");
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

fn advance_turn(game: &mut GuandanGameState) {
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

fn settle_and_redeal_if_complete(game: &mut GuandanGameState) -> Result<bool, &'static str> {
    let active_players = game.hands.iter().filter(|hand| !hand.is_empty()).count();
    if active_players > 1 || game.finish_order.is_empty() {
        return Ok(false);
    }

    let player_count = game.hands.len();
    let table = validate_start(player_count)?;
    let winner = game.finish_order[0];
    let winner_team = team_for_seat(table, winner)?;
    let winner_level = game.team_levels.level_for(winner_team);

    game.last_game_winner = Some(winner);
    game.last_game_winner_team = Some(winner_team);

    let promotion_steps = if player_count == 4 {
        four_player_promotion_steps(table, &game.finish_order)?
    } else {
        1
    };

    if winner_level == Rank::Ace {
        let wins_match = if player_count == 4 {
            four_player_ace_win(table, &game.finish_order)?
        } else {
            true
        };
        if wins_match {
            game.match_winner = Some(winner_team);
            game.trick_complete = true;
            return Ok(true);
        }
    }

    let next_level = if winner_level == Rank::Ace {
        Rank::Ace
    } else {
        game.team_levels
            .advance_winner_by(winner_team, promotion_steps)
    };

    let mut deck = build_deck(table);
    deck.shuffle(&mut thread_rng());
    let (hands, remainder) = deal(table, &deck)?;
    if !remainder.is_empty() {
        return Err("next Guandan deal left undealt cards");
    }

    game.hands = hands;
    game.turn = winner;
    game.level = next_level;
    game.finish_order.clear();
    game.last_play.clear();
    game.last_player = None;
    game.table_plays.clear();
    game.passes = 0;
    game.trick_complete = false;
    Ok(true)
}

fn state_message(game: &GuandanGameState) -> GuandanServerMessage {
    GuandanServerMessage::State {
        players: game.player_names.clone(),
        turn: game.turn,
        hand_counts: game.hand_counts(),
        last_play: game.last_play.clone(),
        last_player: game.last_player,
        table_plays: game.table_plays.clone(),
        passes: game.passes,
        trick_complete: game.trick_complete,
        level: game.level,
        team_levels: game.team_levels,
        finish_order: game.finish_order.clone(),
        last_game_winner: game.last_game_winner,
        last_game_winner_team: game.last_game_winner_team,
        pending_tribute: game.pending_tribute.clone(),
        tribute_resisted: game.tribute_resisted,
        match_winner: game.match_winner,
    }
}

fn validate_play_against_table(
    cards: &[CardFace],
    current: &[CardFace],
    level: Rank,
) -> Result<(), &'static str> {
    let candidate = strength_basic(cards).ok_or("selected cards are not a legal Guandan pattern")?;
    if current.is_empty() {
        return Ok(());
    }
    let table = strength_basic(current).ok_or("current table play is invalid")?;
    if beats_at_level(candidate, table, level) {
        Ok(())
    } else {
        Err("play must beat the current table play")
    }
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
            protocol: "guandan-v17-tribute-commands",
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
                            Ok(state) => state,
                            Err(_) => continue,
                        };
                        state
                            .game
                            .player_names
                            .iter()
                            .position(|player_name| player_name == &name)
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

                let state = match storage.clone().get(key.clone()).await {
                    Ok(state) => state,
                    Err(_) => continue,
                };
                send(
                    &tx,
                    &GuandanServerMessage::Waiting {
                        players: state.game.player_names.clone(),
                        minimum_players: MIN_PLAYERS,
                        maximum_players: MAX_PLAYERS,
                    },
                );

                let mut sub = match storage
                    .clone()
                    .subscribe(key.clone(), subscriber_id)
                    .await
                {
                    Ok(sub) => sub,
                    Err(_) => continue,
                };
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
                    (Some(key), Some(seat)) => (key, seat),
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
                    Ok(table) => table,
                    Err(message) => {
                        send(
                            &tx,
                            &GuandanServerMessage::Error {
                                message: message.to_string(),
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
                        state.game.finish_order.clear();
                        state.game.last_game_winner = None;
                        state.game.last_game_winner_team = None;
                        state.game.pending_tribute = None;
                        state.game.tribute_cards.clear();
                        state.game.return_cards.clear();
                        state.game.tribute_resisted = false;
                        state.game.match_winner = None;
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

                let state = match storage.clone().get(key).await {
                    Ok(state) => state,
                    Err(_) => continue,
                };
                send(
                    &tx,
                    &GuandanServerMessage::Started {
                        player_count,
                        cards_per_player: CARDS_PER_PLAYER,
                    },
                );
                send(&tx, &state_message(&state.game));
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
                    (Some(key), Some(seat)) => (key, seat),
                    _ => continue,
                };

                card_indexes.sort_unstable();
                card_indexes.dedup();
                let indexes = card_indexes;
                let result: Result<u64, PlayError> = storage
                    .clone()
                    .execute_operation_with_messages(key.clone(), move |mut state| {
                        if state.game.normal_play_blocked() {
                            return Err(PlayError::Invalid(
                                "normal play is blocked until tribute is resolved",
                            ));
                        }
                        if !state.game.started
                            || state.game.trick_complete
                            || state.game.turn != seat
                            || indexes.is_empty()
                            || indexes.last().copied().unwrap_or(0)
                                >= state.game.hands[seat].len()
                        {
                            return Err(PlayError::Invalid(
                                "not your turn or invalid card selection",
                            ));
                        }

                        let cards = indexes
                            .iter()
                            .map(|&index| state.game.hands[seat][index])
                            .collect::<Vec<_>>();
                        validate_play_against_table(
                            &cards,
                            &state.game.last_play,
                            state.game.level,
                        )
                        .map_err(PlayError::Invalid)?;

                        for &index in indexes.iter().rev() {
                            state.game.hands[seat].remove(index);
                        }
                        state.game.last_play = cards.clone();
                        state.game.last_player = Some(seat);
                        state.game.table_plays.push(GuandanTablePlay {
                            player: seat,
                            cards,
                        });
                        state.game.passes = 0;

                        if state.game.hands[seat].is_empty()
                            && !state.game.finish_order.contains(&seat)
                        {
                            state.game.finish_order.push(seat);
                        }

                        let settled = settle_and_redeal_if_complete(&mut state.game)
                            .map_err(PlayError::Invalid)?;
                        if !settled {
                            advance_turn(&mut state.game);
                        }
                        state.bump_version();
                        Ok((state, vec![GuandanStorageMessage::StateChanged]))
                    })
                    .await;

                if let Err(error) = result {
                    send(
                        &tx,
                        &GuandanServerMessage::Error {
                            message: error.to_string(),
                        },
                    );
                    continue;
                }

                let state = match storage.clone().get(key).await {
                    Ok(state) => state,
                    Err(_) => continue,
                };
                if let Some(hand) = state.game.private_hand(seat) {
                    send(
                        &tx,
                        &GuandanServerMessage::Hand {
                            cards: hand.to_vec(),
                        },
                    );
                }
            }
            GuandanClientMessage::TributeCard { card_index } => {
                let (key, seat) = match (joined_room.clone(), joined_seat) {
                    (Some(key), Some(seat)) => (key, seat),
                    _ => continue,
                };
                let result: Result<u64, PlayError> = storage
                    .clone()
                    .execute_operation_with_messages(key, move |mut state| {
                        if !state.game.started || state.game.match_winner.is_some() {
                            return Err(PlayError::Invalid("tribute is not available now"));
                        }
                        state
                            .game
                            .submit_tribute_card(seat, card_index)
                            .map_err(PlayError::Invalid)?;
                        state.bump_version();
                        Ok((state, vec![GuandanStorageMessage::StateChanged]))
                    })
                    .await;
                if let Err(error) = result {
                    send(
                        &tx,
                        &GuandanServerMessage::Error {
                            message: error.to_string(),
                        },
                    );
                }
            }
            GuandanClientMessage::ReturnTribute { card_index } => {
                let (key, seat) = match (joined_room.clone(), joined_seat) {
                    (Some(key), Some(seat)) => (key, seat),
                    _ => continue,
                };
                let result: Result<u64, PlayError> = storage
                    .clone()
                    .execute_operation_with_messages(key, move |mut state| {
                        if !state.game.started || state.game.match_winner.is_some() {
                            return Err(PlayError::Invalid("return tribute is not available now"));
                        }
                        state
                            .game
                            .submit_return_card(seat, card_index)
                            .map_err(PlayError::Invalid)?;
                        if state.game.tribute_exchange_complete() {
                            state
                                .game
                                .finalize_tribute_exchange()
                                .map_err(PlayError::Invalid)?;
                        }
                        state.bump_version();
                        Ok((state, vec![GuandanStorageMessage::StateChanged]))
                    })
                    .await;
                if let Err(error) = result {
                    send(
                        &tx,
                        &GuandanServerMessage::Error {
                            message: error.to_string(),
                        },
                    );
                }
            }
            GuandanClientMessage::Pass => {
                let (key, seat) = match (joined_room.clone(), joined_seat) {
                    (Some(key), Some(seat)) => (key, seat),
                    _ => continue,
                };
                let result = storage
                    .clone()
                    .execute_operation_with_messages(key, move |mut state| {
                        if state.game.normal_play_blocked()
                            || !state.game.started
                            || state.game.trick_complete
                            || state.game.turn != seat
                            || state.game.last_player.is_none()
                        {
                            return Err(());
                        }
                        state.game.passes += 1;
                        let active_players = state
                            .game
                            .hands
                            .iter()
                            .filter(|hand| !hand.is_empty())
                            .count();
                        if state.game.passes + 1 >= active_players {
                            state.game.turn = state.game.last_player.unwrap_or(state.game.turn);
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
                    Some(key) => key,
                    None => continue,
                };
                let result = storage
                    .clone()
                    .execute_operation_with_messages(key, move |mut state| {
                        if state.game.normal_play_blocked()
                            || !state.game.started
                            || !state.game.trick_complete
                        {
                            return Err(());
                        }
                        let winner = state.game.last_player.ok_or(())?;
                        state.game.turn = winner;
                        if state.game.hands[winner].is_empty() {
                            advance_turn(&mut state.game);
                        }
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
    use shengji_core::guandan::Suit;

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
    fn rejects_odd_tables() {
        for count in [5usize, 7, 9, 11, 13] {
            assert!(validate_start(count).is_err());
        }
    }

    #[test]
    fn accepts_opening_legal_play() {
        assert!(validate_play_against_table(
            &[card(Suit::Spades, Rank::Ace)],
            &[],
            Rank::Five,
        )
        .is_ok());
    }

    #[test]
    fn current_level_single_beats_ace() {
        assert!(validate_play_against_table(
            &[card(Suit::Spades, Rank::Five)],
            &[card(Suit::Clubs, Rank::Ace)],
            Rank::Five,
        )
        .is_ok());
    }

    #[test]
    fn ace_cannot_beat_current_level_single() {
        assert!(validate_play_against_table(
            &[card(Suit::Spades, Rank::Ace)],
            &[card(Suit::Clubs, Rank::Five)],
            Rank::Five,
        )
        .is_err());
    }

    #[test]
    fn pair_cannot_beat_single() {
        assert!(validate_play_against_table(
            &[
                card(Suit::Spades, Rank::Ace),
                card(Suit::Hearts, Rank::Ace),
            ],
            &[card(Suit::Clubs, Rank::Queen)],
            Rank::Five,
        )
        .is_err());
    }

    #[test]
    fn four_card_bomb_beats_normal_play() {
        assert!(validate_play_against_table(
            &[
                card(Suit::Clubs, Rank::Three),
                card(Suit::Diamonds, Rank::Three),
                card(Suit::Hearts, Rank::Three),
                card(Suit::Spades, Rank::Three),
            ],
            &[card(Suit::Clubs, Rank::Ace)],
            Rank::Five,
        )
        .is_ok());
    }

    #[test]
    fn tribute_commands_deserialize() {
        let tribute: GuandanClientMessage =
            serde_json::from_str(r#"{"type":"tribute_card","card_index":3}"#).unwrap();
        assert!(matches!(
            tribute,
            GuandanClientMessage::TributeCard { card_index: 3 }
        ));
        let returned: GuandanClientMessage =
            serde_json::from_str(r#"{"type":"return_tribute","card_index":2}"#).unwrap();
        assert!(matches!(
            returned,
            GuandanClientMessage::ReturnTribute { card_index: 2 }
        ));
    }

    #[test]
    fn state_message_exposes_tribute_phase() {
        let mut game = GuandanGameState::default();
        game.pending_tribute = Some(TributePlan::Single {
            giver: 3,
            receiver: 0,
        });
        game.tribute_resisted = false;
        let json = encode(&state_message(&game)).unwrap();
        assert!(json.contains("pending_tribute"));
        assert!(json.contains("tribute_resisted"));
    }

    #[test]
    fn one_two_finish_advances_three_levels_and_redeals() {
        let mut game = GuandanGameState::default();
        game.started = true;
        game.player_names = vec!["A1".into(), "B1".into(), "A2".into(), "B2".into()];
        game.hands = vec![vec![], vec![], vec![], vec![card(Suit::Clubs, Rank::Two)]];
        game.finish_order = vec![0, 2, 1];
        assert!(settle_and_redeal_if_complete(&mut game).unwrap());
        assert_eq!(game.last_game_winner, Some(0));
        assert_eq!(game.last_game_winner_team, Some(Team::A));
        assert_eq!(game.team_levels.team_a, Rank::Five);
        assert_eq!(game.team_levels.team_b, Rank::Two);
        assert_eq!(game.level, Rank::Five);
        assert_eq!(game.turn, 0);
        assert!(game.hands.iter().all(|hand| hand.len() == CARDS_PER_PLAYER));
        assert_eq!(game.match_winner, None);
    }

    #[test]
    fn one_three_finish_advances_two_levels() {
        let mut game = GuandanGameState::default();
        game.started = true;
        game.player_names = vec!["A1".into(), "B1".into(), "A2".into(), "B2".into()];
        game.hands = vec![vec![], vec![], vec![], vec![card(Suit::Clubs, Rank::Two)]];
        game.finish_order = vec![0, 1, 2];
        assert!(settle_and_redeal_if_complete(&mut game).unwrap());
        assert_eq!(game.team_levels.team_a, Rank::Four);
        assert_eq!(game.level, Rank::Four);
    }

    #[test]
    fn ace_one_two_finish_ends_match_without_redeal() {
        let mut game = GuandanGameState::default();
        game.started = true;
        game.player_names = vec!["A1".into(), "B1".into(), "A2".into(), "B2".into()];
        game.team_levels.team_a = Rank::Ace;
        game.level = Rank::Ace;
        game.hands = vec![vec![], vec![], vec![], vec![card(Suit::Clubs, Rank::Two)]];
        game.finish_order = vec![0, 2, 1];

        assert!(settle_and_redeal_if_complete(&mut game).unwrap());
        assert_eq!(game.match_winner, Some(Team::A));
        assert_eq!(game.last_game_winner, Some(0));
        assert_eq!(game.last_game_winner_team, Some(Team::A));
        assert_eq!(game.team_levels.team_a, Rank::Ace);
        assert_eq!(game.hands[3].len(), 1);
    }

    #[test]
    fn ace_one_four_finish_stays_on_ace_and_redeals() {
        let mut game = GuandanGameState::default();
        game.started = true;
        game.player_names = vec!["A1".into(), "B1".into(), "A2".into(), "B2".into()];
        game.team_levels.team_a = Rank::Ace;
        game.level = Rank::Ace;
        game.hands = vec![vec![], vec![], vec![card(Suit::Clubs, Rank::Two)], vec![]];
        game.finish_order = vec![0, 1, 3];

        assert!(settle_and_redeal_if_complete(&mut game).unwrap());
        assert_eq!(game.match_winner, None);
        assert_eq!(game.team_levels.team_a, Rank::Ace);
        assert_eq!(game.level, Rank::Ace);
        assert!(game.hands.iter().all(|hand| hand.len() == CARDS_PER_PLAYER));
    }
}
