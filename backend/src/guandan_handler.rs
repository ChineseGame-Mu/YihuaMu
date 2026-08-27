//! Guandan websocket protocol backed by the shared room storage.

use std::{collections::HashMap, fmt, sync::Mutex, thread, time::Duration};

use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use rand::seq::SliceRandom;
use rand::{thread_rng, Rng};
use serde::{Deserialize, Serialize};
use shengji_core::guandan::{
    compare::beats_at_level,
    deck::{build_deck, deal, CARDS_PER_PLAYER},
    strength::strengths_at_level,
    team::{team_for_seat, Team, TeamLevels},
    tribute::{can_resist_tribute, four_player_tribute_plan, TributePlan},
    CardFace, Joker, Rank, Suit, TableConfig,
};
use storage::{HashMapStorage, Storage};
use tokio::sync::mpsc;

use crate::guandan_serving_types::{
    GuandanGameState, GuandanNextRoundPhase, GuandanStorageMessage, GuandanTablePlay,
    VersionedGuandanGame,
};

const GUANDAN_MIN_PLAYER_COUNT: usize = 4;
const GUANDAN_MAX_PLAYER_COUNT: usize = 14;
const GUANDAN_CLASSIC_PLAYER_COUNT: usize = 4;

lazy_static::lazy_static! {
    static ref GUANDAN_OBSERVERS: Mutex<HashMap<Vec<u8>, Vec<String>>> =
        Mutex::new(HashMap::new());
    static ref GUANDAN_CONNECTIONS: Mutex<HashMap<Vec<u8>, HashMap<String, usize>>> =
        Mutex::new(HashMap::new());
}

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GuandanClientMessage {
    Join {
        room: String,
        name: String,
    },
    ReorderPlayers {
        order: [usize; 2],
    },
    SetParticipation {
        active: bool,
    },
    SetCardCountAlertThreshold {
        threshold: usize,
    },
    SetBots {
        count: usize,
    },
    Start {
        player_count: usize,
    },
    ShuffleNextRound {
        from_position: Option<usize>,
        to_position: Option<usize>,
    },
    DealNextRound,
    Play {
        card_indexes: Vec<usize>,
    },
    TributeCard {
        card_index: usize,
    },
    ReturnTribute {
        card_index: usize,
    },
    Pass,
    EndRound,
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GuandanServerMessage {
    Connected {
        protocol: &'static str,
    },
    Joined {
        room: String,
        seat: Option<usize>,
    },
    Waiting {
        players: Vec<String>,
        pending_players: Vec<String>,
        observers: Vec<String>,
        online_players: Vec<bool>,
        minimum_players: usize,
        maximum_players: usize,
        card_count_alert_threshold: usize,
    },
    Started {
        player_count: usize,
        cards_per_player: usize,
    },
    Hand {
        cards: Vec<CardFace>,
    },
    State {
        players: Vec<String>,
        pending_players: Vec<String>,
        observers: Vec<String>,
        online_players: Vec<bool>,
        turn: usize,
        hand_counts: Vec<usize>,
        last_play: Vec<CardFace>,
        last_player: Option<usize>,
        table_plays: Vec<GuandanTablePlay>,
        passes: usize,
        trick_complete: bool,
        last_trick_winner: Option<usize>,
        initial_draw: Vec<CardFace>,
        initial_draw_winner: Option<usize>,
        level: Rank,
        team_levels: TeamLevels,
        finish_order: Vec<usize>,
        last_game_winner: Option<usize>,
        last_game_winner_team: Option<Team>,
        last_promotion_steps: Option<usize>,
        pending_tribute: Option<TributePlan>,
        tribute_resisted: bool,
        match_winner: Option<Team>,
        next_round_phase: Option<GuandanNextRoundPhase>,
        card_count_alert_threshold: usize,
    },
    Error {
        message: String,
    },
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
    if !(GUANDAN_MIN_PLAYER_COUNT..=GUANDAN_MAX_PLAYER_COUNT).contains(&player_count)
        || !player_count.is_multiple_of(2)
    {
        return Err("Guandan requires an even player count from 4 through 14");
    }
    TableConfig::new(player_count)
}
fn validate_starting_seat(seat: Option<usize>) -> Result<usize, &'static str> {
    seat.ok_or("observers cannot start the game")
}
fn encode(message: &GuandanServerMessage) -> Option<String> {
    serde_json::to_string(message).ok()
}
fn send(tx: &mpsc::UnboundedSender<String>, message: &GuandanServerMessage) {
    if let Some(text) = encode(message) {
        let _ = tx.send(text);
    }
}
fn observers_for(key: &[u8]) -> Vec<String> {
    GUANDAN_OBSERVERS
        .lock()
        .ok()
        .and_then(|observers| observers.get(key).cloned())
        .unwrap_or_default()
}
fn set_connected(key: &[u8], name: &str, connected: bool) {
    let Ok(mut rooms) = GUANDAN_CONNECTIONS.lock() else {
        return;
    };
    let room = rooms.entry(key.to_vec()).or_default();
    if connected {
        *room.entry(name.to_string()).or_default() += 1;
    } else if let Some(count) = room.get_mut(name) {
        *count = count.saturating_sub(1);
        if *count == 0 {
            room.remove(name);
        }
    }
    if room.is_empty() {
        rooms.remove(key);
    }
}
fn online_players(key: &[u8], game: &GuandanGameState) -> Vec<bool> {
    let rooms = GUANDAN_CONNECTIONS.lock().ok();
    let room = rooms.as_ref().and_then(|rooms| rooms.get(key));
    game.player_names
        .iter()
        .map(|name| room.and_then(|room| room.get(name)).copied().unwrap_or(0) > 0)
        .collect()
}
fn normalize_room_name(room: &str) -> String {
    room.trim().trim_end_matches('/').trim_end().to_string()
}
async fn current_seat(
    storage: &HashMapStorage<VersionedGuandanGame>,
    key: &[u8],
    name: &str,
) -> Option<usize> {
    storage
        .clone()
        .get(key.to_vec())
        .await
        .ok()?
        .game
        .player_names
        .iter()
        .position(|player_name| player_name == name)
}
fn waiting_message(key: &[u8], game: &GuandanGameState) -> GuandanServerMessage {
    GuandanServerMessage::Waiting {
        players: game.player_names.clone(),
        pending_players: game.pending_players.clone(),
        observers: observers_for(key),
        online_players: online_players(key, game),
        minimum_players: GUANDAN_MIN_PLAYER_COUNT,
        maximum_players: GUANDAN_MAX_PLAYER_COUNT,
        card_count_alert_threshold: game.card_count_alert_threshold,
    }
}
fn state_message(key: &[u8], game: &GuandanGameState) -> GuandanServerMessage {
    GuandanServerMessage::State {
        players: game.player_names.clone(),
        pending_players: game.pending_players.clone(),
        observers: observers_for(key),
        online_players: online_players(key, game),
        turn: game.turn,
        hand_counts: game.hand_counts(),
        last_play: game.last_play.clone(),
        last_player: game.last_player,
        table_plays: game.table_plays.clone(),
        passes: game.passes,
        trick_complete: game.trick_complete,
        last_trick_winner: game.last_trick_winner,
        initial_draw: game.initial_draw.clone(),
        initial_draw_winner: game.initial_draw_winner,
        level: game.level,
        team_levels: game.team_levels,
        finish_order: game.finish_order.clone(),
        last_game_winner: game.last_game_winner,
        last_game_winner_team: game.last_game_winner_team,
        last_promotion_steps: game.last_promotion_steps,
        pending_tribute: game.pending_tribute.clone(),
        tribute_resisted: game.tribute_resisted,
        match_winner: game.match_winner,
        next_round_phase: game.next_round_phase,
        card_count_alert_threshold: game.card_count_alert_threshold,
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
fn is_robot_name(name: &str) -> bool {
    name.starts_with("机器人")
}

fn initial_draw_value(card: CardFace) -> usize {
    match card {
        CardFace::Joker(Joker::Big) => 1000,
        CardFace::Joker(Joker::Small) => 900,
        CardFace::Suited { suit, rank } => {
            let suit_value = match suit {
                Suit::Clubs => 0,
                Suit::Diamonds => 1,
                Suit::Spades => 2,
                Suit::Hearts => 3,
            };
            (rank as usize) * 10 + suit_value
        }
    }
}

fn draw_starting_seat(deck: &mut [CardFace], player_count: usize) -> (Vec<CardFace>, usize) {
    loop {
        deck.shuffle(&mut thread_rng());
        let draw = deck
            .iter()
            .copied()
            .filter(|card| !matches!(card, CardFace::Joker(_)))
            .take(player_count)
            .collect::<Vec<_>>();
        let values = draw
            .iter()
            .copied()
            .map(initial_draw_value)
            .collect::<Vec<_>>();
        let max_value = *values.iter().max().expect("Guandan deck has cards");
        if values.iter().filter(|value| **value == max_value).count() == 1 {
            let winner = values
                .iter()
                .position(|value| *value == max_value)
                .expect("unique winner");
            return (draw, winner);
        }
    }
}

fn settle_multiplayer_if_complete(game: &mut GuandanGameState) -> Result<bool, &'static str> {
    let player_count = game.hands.len();
    if player_count <= GUANDAN_CLASSIC_PLAYER_COUNT
        || player_count > GUANDAN_MAX_PLAYER_COUNT
        || !player_count.is_multiple_of(2)
    {
        return Err("expanded Guandan settlement requires 6 to 14 even players");
    }
    if game.finish_order.len() == player_count - 1 {
        let last_seat = (0..player_count)
            .find(|seat| !game.finish_order.contains(seat))
            .ok_or("unable to determine final place")?;
        game.finish_order.push(last_seat);
        game.hands[last_seat].clear();
    }
    if game.hands.iter().any(|hand| !hand.is_empty()) || game.finish_order.is_empty() {
        return Ok(false);
    }
    if game.finish_order.len() != player_count {
        return Err("expanded Guandan settlement requires a complete finish order");
    }
    let winner = *game.finish_order.first().ok_or("finish order is empty")?;
    let winner_team = if winner % 2 == 0 { Team::A } else { Team::B };
    let winner_level = game.team_levels.level_for(winner_team);
    game.last_game_winner = Some(winner);
    game.last_game_winner_team = Some(winner_team);
    game.last_promotion_steps = Some(1);
    if winner_level == Rank::Ace {
        game.match_winner = Some(winner_team);
        game.trick_complete = true;
        return Ok(true);
    }
    game.level = game.team_levels.advance_winner(winner_team);
    game.turn = winner;
    game.next_round_finish_order = game.finish_order[..player_count - 1].to_vec();
    game.next_round_phase = Some(GuandanNextRoundPhase::AwaitingShuffle);
    game.promote_pending_players(GUANDAN_MAX_PLAYER_COUNT);
    game.last_play.clear();
    game.last_player = None;
    game.table_plays.clear();
    game.passes = 0;
    game.trick_complete = false;
    game.last_trick_winner = None;
    game.pending_tribute = None;
    game.tribute_cards.clear();
    game.return_cards.clear();
    game.tribute_resisted = false;
    Ok(true)
}

fn settle_and_redeal_if_complete(game: &mut GuandanGameState) -> Result<bool, &'static str> {
    let player_count = game.hands.len();
    if player_count != GUANDAN_CLASSIC_PLAYER_COUNT {
        return settle_multiplayer_if_complete(game);
    }
    if game.finish_order.len() == 2 {
        let first = game.finish_order[0];
        let second = game.finish_order[1];
        if first % 2 == second % 2 {
            for seat in 0..player_count {
                if !game.finish_order.contains(&seat) {
                    game.finish_order.push(seat);
                    game.hands[seat].clear();
                }
            }
        }
    }
    if game.finish_order.len() == player_count - 1 {
        let last_seat = (0..player_count)
            .find(|seat| !game.finish_order.contains(seat))
            .ok_or("unable to determine fourth place")?;
        game.finish_order.push(last_seat);
        game.hands[last_seat].clear();
    }
    let active_players = game.hands.iter().filter(|hand| !hand.is_empty()).count();
    if active_players > 0 || game.finish_order.is_empty() {
        return Ok(false);
    }
    if game.finish_order.len() != player_count {
        return Err("Guandan settlement requires a complete finish order");
    }
    let previous_finish_order = game.finish_order.clone();
    let winner = *previous_finish_order
        .first()
        .ok_or("finish order is empty")?;
    if winner >= player_count {
        return Err("winner seat is outside the table");
    }
    let winner_team = if winner % 2 == 0 { Team::A } else { Team::B };
    let winner_level = game.team_levels.level_for(winner_team);
    game.last_game_winner = Some(winner);
    game.last_game_winner_team = Some(winner_team);
    let completed_finish_order = previous_finish_order.clone();
    let partner = (winner + 2) % player_count;
    let partner_place = completed_finish_order
        .iter()
        .position(|seat| *seat == partner)
        .ok_or("winner partner is missing from finish order")?
        + 1;
    let promotion_steps = match partner_place {
        2 => 3,
        3 => 2,
        4 => 1,
        _ => return Err("invalid partner finishing place"),
    };
    game.last_promotion_steps = Some(promotion_steps);
    if winner_level == Rank::Ace && promotion_steps >= 2 {
        game.match_winner = Some(winner_team);
        game.trick_complete = true;
        return Ok(true);
    }
    let next_level = if winner_level == Rank::Ace {
        Rank::Ace
    } else {
        game.team_levels
            .advance_winner_by(winner_team, promotion_steps)
    };
    game.turn = winner;
    game.level = next_level;
    game.next_round_finish_order = completed_finish_order[..player_count - 1].to_vec();
    game.next_round_phase = Some(GuandanNextRoundPhase::AwaitingShuffle);
    game.promote_pending_players(GUANDAN_MAX_PLAYER_COUNT);
    game.last_play.clear();
    game.last_player = None;
    game.table_plays.clear();
    game.passes = 0;
    game.trick_complete = false;
    game.last_trick_winner = None;
    game.pending_tribute = None;
    game.tribute_cards.clear();
    game.return_cards.clear();
    game.tribute_resisted = false;
    Ok(true)
}

fn validate_play_against_table(
    cards: &[CardFace],
    current: &[CardFace],
    level: Rank,
) -> Result<(), &'static str> {
    let candidates = strengths_at_level(cards, level);
    if candidates.is_empty() {
        return Err("selected cards are not a legal Guandan pattern");
    }
    if current.is_empty() {
        return Ok(());
    }
    let table_strengths = strengths_at_level(current, level);
    if table_strengths.is_empty() {
        return Err("current table play is invalid");
    }
    if candidates.iter().any(|candidate| {
        table_strengths
            .iter()
            .all(|table| beats_at_level(*candidate, *table, level))
    }) {
        Ok(())
    } else {
        Err("play must beat the current table play")
    }
}

fn run_robot_turns(game: &mut GuandanGameState) -> Result<(), &'static str> {
    for _ in 0..1 {
        if game.normal_play_blocked() || !game.started || game.trick_complete {
            break;
        }
        let seat = game.turn;
        if !game
            .player_names
            .get(seat)
            .is_some_and(|name| is_robot_name(name))
        {
            break;
        }
        let delay_ms = thread_rng().gen_range(800..=1800);
        thread::sleep(Duration::from_millis(delay_ms));
        let chosen = game.hands[seat]
            .iter()
            .enumerate()
            .find_map(|(index, card)| {
                validate_play_against_table(&[*card], &game.last_play, game.level)
                    .is_ok()
                    .then_some(index)
            });
        if let Some(index) = chosen {
            let card = game.hands[seat].remove(index);
            let cards = vec![card];
            game.last_play = cards.clone();
            game.last_player = Some(seat);
            game.table_plays.push(GuandanTablePlay {
                player: seat,
                cards,
            });
            game.passes = 0;
            if game.hands[seat].is_empty() && !game.finish_order.contains(&seat) {
                game.finish_order.push(seat);
            }
            let settled = settle_and_redeal_if_complete(game)?;
            if !settled {
                advance_turn(game);
            }
            continue;
        }
        if game.last_player.is_none() {
            return Err("robot has no legal lead");
        }
        game.passes += 1;
        let winner = game.last_player.unwrap_or(game.turn);
        let required_passes = game
            .hands
            .iter()
            .enumerate()
            .filter(|(index, hand)| *index != winner && !hand.is_empty())
            .count();
        if game.passes >= required_passes {
            game.last_trick_winner = Some(winner);
            game.turn = winner;
            if game.hands[winner].is_empty() {
                advance_turn(game);
            }
            game.last_play.clear();
            game.last_player = None;
            game.table_plays.clear();
            game.passes = 0;
            game.trick_complete = false;
        } else {
            advance_turn(game);
        }
    }
    Ok(())
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
            protocol: "guandan-v21-reconnect",
        },
    );
    let mut joined_room: Option<Vec<u8>> = None;
    let mut joined_name: Option<String> = None;
    let mut joined_as_observer = false;
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
                let room = normalize_room_name(&room);
                let name = name.trim().to_string();
                if room.is_empty() || name.is_empty() {
                    send(
                        &tx,
                        &GuandanServerMessage::Error {
                            message: "room and name are required".to_string(),
                        },
                    );
                    continue;
                }
                let key = room.as_bytes().to_vec();
                let existing_seat = current_seat(&storage, &key, &name).await;
                let seat = if let Some(seat) = existing_seat {
                    Some(seat)
                } else {
                    let name_for_state = name.clone();
                    let room_has_connected_players = GUANDAN_CONNECTIONS
                        .lock()
                        .ok()
                        .and_then(|rooms| rooms.get(&key).cloned())
                        .is_some_and(|players| players.values().any(|count| *count > 0));
                    let seat_result = storage
                        .clone()
                        .execute_operation_with_messages(key.clone(), move |mut state| {
                            if state.game.started {
                                if room_has_connected_players {
                                    let reserved = state.game.player_names.len()
                                        + state.game.pending_players.len();
                                    if reserved >= GUANDAN_MAX_PLAYER_COUNT {
                                        return Err(());
                                    }
                                    if !state
                                        .game
                                        .pending_players
                                        .iter()
                                        .any(|pending| pending == &name_for_state)
                                    {
                                        state.game.pending_players.push(name_for_state);
                                    }
                                    if state.game.next_round_phase
                                        == Some(GuandanNextRoundPhase::AwaitingShuffle)
                                    {
                                        state
                                            .game
                                            .promote_pending_players(GUANDAN_MAX_PLAYER_COUNT);
                                    }
                                    state.bump_version();
                                    return Ok((state, vec![GuandanStorageMessage::StateChanged]));
                                }
                                state.game = GuandanGameState::default();
                            } else if state.game.player_names.len() >= GUANDAN_MAX_PLAYER_COUNT {
                                if room_has_connected_players {
                                    return Err(());
                                }
                                state.game = GuandanGameState::default();
                            }
                            state.game.player_names.push(name_for_state);
                            state.bump_version();
                            Ok((state, vec![GuandanStorageMessage::StateChanged]))
                        })
                        .await;
                    match current_seat(&storage, &key, &name).await {
                        Some(seat) => Some(seat),
                        None => {
                            let is_pending = storage
                                .clone()
                                .get(key.clone())
                                .await
                                .ok()
                                .is_some_and(|state| {
                                    state
                                        .game
                                        .pending_players
                                        .iter()
                                        .any(|pending| pending == &name)
                                });
                            if is_pending {
                                None
                            } else if seat_result.is_err() {
                                let room_exists = storage.clone().get(key.clone()).await.is_ok();
                                if !room_exists {
                                    send(
                                        &tx,
                                        &GuandanServerMessage::Error {
                                            message: "unable to join this room".to_string(),
                                        },
                                    );
                                    continue;
                                }
                                if let Ok(mut observers) = GUANDAN_OBSERVERS.lock() {
                                    let room_observers = observers.entry(key.clone()).or_default();
                                    if !room_observers.iter().any(|observer| observer == &name) {
                                        room_observers.push(name.clone());
                                    }
                                }
                                joined_as_observer = true;
                                None
                            } else {
                                continue;
                            }
                        }
                    }
                };
                joined_room = Some(key.clone());
                joined_name = Some(name.clone());
                set_connected(&key, &name, true);
                send(
                    &tx,
                    &GuandanServerMessage::Joined {
                        room: room.clone(),
                        seat,
                    },
                );
                if let Ok(state) = storage.clone().get(key.clone()).await {
                    if state.game.started {
                        send(
                            &tx,
                            &GuandanServerMessage::Started {
                                player_count: state.game.player_names.len(),
                                cards_per_player: CARDS_PER_PLAYER,
                            },
                        );
                        send(&tx, &state_message(&key, &state.game));
                        match state.game.next_round_phase {
                            None => {
                                if let Some(hand) =
                                    seat.and_then(|seat| state.game.private_hand(seat))
                                {
                                    send(
                                        &tx,
                                        &GuandanServerMessage::Hand {
                                            cards: hand.to_vec(),
                                        },
                                    );
                                }
                            }
                            Some(GuandanNextRoundPhase::AwaitingShuffle) => {
                                send(&tx, &GuandanServerMessage::Hand { cards: vec![] })
                            }
                            Some(GuandanNextRoundPhase::AwaitingDeal) => {}
                        }
                    } else {
                        send(&tx, &waiting_message(&key, &state.game));
                    }
                }
                let mut sub = match storage.clone().subscribe(key.clone(), subscriber_id).await {
                    Ok(sub) => sub,
                    Err(_) => continue,
                };
                let tx_sub = tx.clone();
                let storage_sub = storage.clone();
                let name_sub = name;
                let key_sub = key.clone();
                let room_sub = room.clone();
                let mut announced_seat = seat;
                subscription_task = Some(tokio::spawn(async move {
                    while sub.recv().await.is_some() {
                        if let Ok(state) = storage_sub.clone().get(key_sub.clone()).await {
                            let seat_sub = state
                                .game
                                .player_names
                                .iter()
                                .position(|player_name| player_name == &name_sub);
                            if seat_sub != announced_seat {
                                send(
                                    &tx_sub,
                                    &GuandanServerMessage::Joined {
                                        room: room_sub.clone(),
                                        seat: seat_sub,
                                    },
                                );
                                announced_seat = seat_sub;
                            }
                            if state.game.started {
                                send(
                                    &tx_sub,
                                    &GuandanServerMessage::Started {
                                        player_count: state.game.player_names.len(),
                                        cards_per_player: CARDS_PER_PLAYER,
                                    },
                                );
                                send(&tx_sub, &state_message(&key_sub, &state.game));
                                match state.game.next_round_phase {
                                    None => {
                                        if let Some(seat_sub) = seat_sub {
                                            if let Some(hand) = state.game.private_hand(seat_sub) {
                                                send(
                                                    &tx_sub,
                                                    &GuandanServerMessage::Hand {
                                                        cards: hand.to_vec(),
                                                    },
                                                );
                                            }
                                        }
                                    }
                                    Some(GuandanNextRoundPhase::AwaitingShuffle) => {
                                        send(&tx_sub, &GuandanServerMessage::Hand { cards: vec![] })
                                    }
                                    Some(GuandanNextRoundPhase::AwaitingDeal) => {}
                                }
                            } else {
                                send(&tx_sub, &waiting_message(&key_sub, &state.game));
                            }
                        }
                    }
                }));
                let _: Result<u64, ()> = storage
                    .clone()
                    .execute_operation_with_messages(key, move |mut state| {
                        state.bump_version();
                        Ok((state, vec![GuandanStorageMessage::StateChanged]))
                    })
                    .await;
            }
            GuandanClientMessage::SetParticipation { active } => {
                let (key, name) = match (joined_room.clone(), joined_name.clone()) {
                    (Some(key), Some(name)) => (key, name),
                    _ => continue,
                };
                let key_for_state = key.clone();
                let name_for_state = name.clone();
                let result = storage
                    .clone()
                    .execute_operation_with_messages(key.clone(), move |mut state| {
                        let mut observers = GUANDAN_OBSERVERS.lock().map_err(|_| ())?;
                        let room_observers = observers.entry(key_for_state.clone()).or_default();
                        if state.game.started {
                            if active {
                                if state.game.player_names.iter().any(|n| n == &name_for_state)
                                    || state
                                        .game
                                        .pending_players
                                        .iter()
                                        .any(|n| n == &name_for_state)
                                {
                                    return Ok((state, vec![]));
                                }
                                let observer_index = room_observers
                                    .iter()
                                    .position(|n| n == &name_for_state)
                                    .ok_or(())?;
                                let reserved = state.game.player_names.len()
                                    + state.game.pending_players.len();
                                if reserved >= GUANDAN_MAX_PLAYER_COUNT {
                                    return Err(());
                                }
                                room_observers.remove(observer_index);
                                state.game.pending_players.push(name_for_state);
                                if state.game.next_round_phase
                                    == Some(GuandanNextRoundPhase::AwaitingShuffle)
                                {
                                    state.game.promote_pending_players(GUANDAN_MAX_PLAYER_COUNT);
                                }
                            } else {
                                if state.game.player_names.iter().any(|n| n == &name_for_state) {
                                    return Err(());
                                }
                                let pending_index = state
                                    .game
                                    .pending_players
                                    .iter()
                                    .position(|n| n == &name_for_state)
                                    .ok_or(())?;
                                let removed = state.game.pending_players.remove(pending_index);
                                if !room_observers.iter().any(|n| n == &removed) {
                                    room_observers.push(removed);
                                }
                            }
                        } else if active {
                            if state.game.player_names.iter().any(|n| n == &name_for_state) {
                                return Ok((state, vec![]));
                            }
                            let observer_index = room_observers
                                .iter()
                                .position(|n| n == &name_for_state)
                                .ok_or(())?;
                            if state.game.player_names.len() >= GUANDAN_MAX_PLAYER_COUNT {
                                return Err(());
                            }
                            room_observers.remove(observer_index);
                            state.game.player_names.push(name_for_state);
                        } else {
                            let player_index = state
                                .game
                                .player_names
                                .iter()
                                .position(|n| n == &name_for_state)
                                .ok_or(())?;
                            let removed = state.game.player_names.remove(player_index);
                            if !room_observers.iter().any(|n| n == &removed) {
                                room_observers.push(removed);
                            }
                        }
                        state.bump_version();
                        Ok((state, vec![GuandanStorageMessage::StateChanged]))
                    })
                    .await;
                if result.is_err() {
                    send(
                        &tx,
                        &GuandanServerMessage::Error {
                            message: "participation cannot be changed in the requested state"
                                .to_string(),
                        },
                    );
                } else {
                    joined_as_observer = !active;
                }
            }
            GuandanClientMessage::SetCardCountAlertThreshold { threshold } => {
                let (key, name) = match (joined_room.clone(), joined_name.clone()) {
                    (Some(key), Some(name)) => (key, name),
                    _ => continue,
                };
                if current_seat(&storage, &key, &name).await.is_none() {
                    continue;
                }
                let result = storage
                    .clone()
                    .execute_operation_with_messages(key, move |mut state| {
                        let can_change = !state.game.started
                            || state.game.next_round_phase
                                == Some(GuandanNextRoundPhase::AwaitingShuffle);
                        if !can_change || !(6..=10).contains(&threshold) {
                            return Err(());
                        }
                        state.game.card_count_alert_threshold = threshold;
                        state.bump_version();
                        Ok((state, vec![GuandanStorageMessage::StateChanged]))
                    })
                    .await;
                if result.is_err() {
                    send(
                        &tx,
                        &GuandanServerMessage::Error {
                            message: "card count alert threshold must be 6 through 10 and can only change before a round is locked"
                                .to_string(),
                        },
                    );
                }
            }
            GuandanClientMessage::SetBots { count } => {
                let (key, name) = match (joined_room.clone(), joined_name.clone()) {
                    (Some(key), Some(name)) => (key, name),
                    _ => continue,
                };
                if current_seat(&storage, &key, &name).await.is_none() {
                    continue;
                }
                let result = storage
                    .clone()
                    .execute_operation_with_messages(key, move |mut state| {
                        if state.game.started || !(1..=3).contains(&count) {
                            return Err(());
                        }
                        state
                            .game
                            .player_names
                            .retain(|player| !is_robot_name(player));
                        let human_count = state.game.player_names.len();
                        if human_count + count > GUANDAN_MAX_PLAYER_COUNT {
                            return Err(());
                        }
                        for index in 1..=count {
                            state.game.player_names.push(format!("机器人{index}"));
                        }
                        state.bump_version();
                        Ok((state, vec![GuandanStorageMessage::StateChanged]))
                    })
                    .await;
                if result.is_err() {
                    send(
                        &tx,
                        &GuandanServerMessage::Error {
                            message: "robot count must fit the selected table before start"
                                .to_string(),
                        },
                    );
                }
            }
            GuandanClientMessage::ReorderPlayers { order } => {
                let (key, name) = match (joined_room.clone(), joined_name.clone()) {
                    (Some(key), Some(name)) => (key, name),
                    _ => continue,
                };
                let result = storage
                    .clone()
                    .execute_operation_with_messages(key, move |mut state| {
                        let len = state.game.player_names.len();
                        let can_reorder = !state.game.started
                            || state.game.next_round_phase
                                == Some(GuandanNextRoundPhase::AwaitingShuffle);
                        if !can_reorder
                            || order[0] >= len
                            || order[1] >= len
                            || order[0] == order[1]
                            || order[0] % 2 != order[1] % 2
                        {
                            return Err(());
                        }
                        let current = state
                            .game
                            .player_names
                            .iter()
                            .position(|player_name| player_name == &name)
                            .ok_or(())?;
                        if current != order[0] && current != order[1] {
                            return Err(());
                        }
                        state
                            .game
                            .swap_same_team_seats(order[0], order[1])
                            .map_err(|_| ())?;
                        state.bump_version();
                        Ok((state, vec![GuandanStorageMessage::StateChanged]))
                    })
                    .await;
                if result.is_err() {
                    send(
                        &tx,
                        &GuandanServerMessage::Error {
                            message:
                                "players may only swap within the same team before start or while awaiting the next shuffle"
                                    .to_string(),
                        },
                    );
                }
            }
            GuandanClientMessage::Start { player_count } => {
                let (key, name) = match (joined_room.clone(), joined_name.clone()) {
                    (Some(key), Some(name)) => (key, name),
                    _ => continue,
                };
                let seat = match validate_starting_seat(current_seat(&storage, &key, &name).await) {
                    Ok(seat) => seat,
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
                        if state.game.started || state.game.player_names.len() != table.player_count
                        {
                            return Err(());
                        }
                        let mut rng = thread_rng();
                        let mut deck = build_deck(table);
                        deck.shuffle(&mut rng);
                        let (hands, remainder) = deal(table, &deck).map_err(|_| ())?;
                        if !remainder.is_empty() {
                            return Err(());
                        }
                        let mut draw_deck = build_deck(table);
                        let (initial_draw, draw_winner) =
                            draw_starting_seat(&mut draw_deck, table.player_count);
                        state.game.started = true;
                        state.game.hands = hands;
                        state.game.turn = draw_winner;
                        state.game.initial_draw = initial_draw;
                        state.game.initial_draw_winner = Some(draw_winner);
                        state.game.last_play.clear();
                        state.game.last_player = None;
                        state.game.table_plays.clear();
                        state.game.passes = 0;
                        state.game.trick_complete = false;
                        state.game.last_trick_winner = None;
                        state.game.finish_order.clear();
                        state.game.last_game_winner = None;
                        state.game.last_game_winner_team = None;
                        state.game.last_promotion_steps = None;
                        state.game.pending_tribute = None;
                        state.game.tribute_cards.clear();
                        state.game.return_cards.clear();
                        state.game.tribute_resisted = false;
                        state.game.match_winner = None;
                        state.game.next_round_phase = None;
                        state.game.next_round_finish_order.clear();
                        run_robot_turns(&mut state.game).map_err(|_| ())?;
                        state.bump_version();
                        Ok((state, vec![GuandanStorageMessage::StateChanged]))
                    })
                    .await;
                if result.is_err() {
                    send(
                        &tx,
                        &GuandanServerMessage::Error {
                            message:
                                "the game is already underway or the requested seated player count is not ready"
                                    .to_string(),
                        },
                    );
                    continue;
                }
                if let Ok(state) = storage.clone().get(key.clone()).await {
                    send(
                        &tx,
                        &GuandanServerMessage::Started {
                            player_count,
                            cards_per_player: CARDS_PER_PLAYER,
                        },
                    );
                    send(&tx, &state_message(&key, &state.game));
                    if let Some(hand) = state.game.private_hand(seat) {
                        send(
                            &tx,
                            &GuandanServerMessage::Hand {
                                cards: hand.to_vec(),
                            },
                        );
                    }
                }
            }
            GuandanClientMessage::ShuffleNextRound {
                from_position,
                to_position,
            } => {
                let (key, name) = match (joined_room.clone(), joined_name.clone()) {
                    (Some(key), Some(name)) => (key, name),
                    _ => continue,
                };
                let seat = match current_seat(&storage, &key, &name).await {
                    Some(seat) => seat,
                    None => continue,
                };
                let result: Result<u64, PlayError> = storage
                    .clone()
                    .execute_operation_with_messages(key, move |mut state| {
                        if state.game.next_round_phase
                            != Some(GuandanNextRoundPhase::AwaitingShuffle)
                        {
                            return Err(PlayError::Invalid(
                                "the next round is not ready to shuffle",
                            ));
                        }
                        let table = validate_start(state.game.player_names.len())
                            .map_err(PlayError::Invalid)?;
                        let winner_team = state
                            .game
                            .last_game_winner_team
                            .ok_or(PlayError::Invalid("the previous winner is unavailable"))?;
                        if team_for_seat(table, seat).map_err(PlayError::Invalid)? == winner_team {
                            return Err(PlayError::Invalid(
                                "only a player on the losing team may shuffle",
                            ));
                        }
                        let mut deck = build_deck(table);
                        match (from_position, to_position) {
                            (None, None) => deck.shuffle(&mut thread_rng()),
                            (Some(from), Some(to))
                                if (1..=deck.len()).contains(&from)
                                    && (1..=deck.len()).contains(&to) =>
                            {
                                let card = deck.remove(from - 1);
                                deck.insert(to - 1, card);
                            }
                            _ => {
                                return Err(PlayError::Invalid(
                                    "shuffle positions must both be inside the current deck",
                                ))
                            }
                        }
                        let (hands, remainder) = deal(table, &deck).map_err(PlayError::Invalid)?;
                        if !remainder.is_empty() {
                            return Err(PlayError::Invalid("next Guandan deal left undealt cards"));
                        }
                        state.game.hands = hands;
                        state.game.next_round_phase = Some(GuandanNextRoundPhase::AwaitingDeal);
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
            GuandanClientMessage::DealNextRound => {
                let (key, name) = match (joined_room.clone(), joined_name.clone()) {
                    (Some(key), Some(name)) => (key, name),
                    _ => continue,
                };
                let seat = match current_seat(&storage, &key, &name).await {
                    Some(seat) => seat,
                    None => continue,
                };
                let result: Result<u64, PlayError> = storage
                    .clone()
                    .execute_operation_with_messages(key, move |mut state| {
                        if state.game.next_round_phase != Some(GuandanNextRoundPhase::AwaitingDeal)
                        {
                            return Err(PlayError::Invalid("the next round is not ready to deal"));
                        }
                        if state.game.last_game_winner != Some(seat) {
                            return Err(PlayError::Invalid("only the previous winner may deal"));
                        }
                        let table = validate_start(state.game.player_names.len())
                            .map_err(PlayError::Invalid)?;
                        if table.player_count == GUANDAN_CLASSIC_PLAYER_COUNT {
                            let plan = four_player_tribute_plan(
                                table,
                                &state.game.next_round_finish_order,
                            )
                            .map_err(PlayError::Invalid)?;
                            if can_resist_tribute(&plan, &state.game.hands) {
                                state.game.tribute_resisted = true;
                            } else {
                                state.game.pending_tribute = Some(plan);
                            }
                        } else {
                            state.game.pending_tribute = None;
                            state.game.tribute_resisted = false;
                        }
                        state.game.finish_order.clear();
                        state.game.next_round_finish_order.clear();
                        state.game.next_round_phase = None;
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
            GuandanClientMessage::Play { mut card_indexes } => {
                let (key, name) = match (joined_room.clone(), joined_name.clone()) {
                    (Some(key), Some(name)) => (key, name),
                    _ => continue,
                };
                let seat = match current_seat(&storage, &key, &name).await {
                    Some(seat) => seat,
                    None => continue,
                };
                card_indexes.sort_unstable();
                card_indexes.dedup();
                let indexes = card_indexes;
                let result: Result<u64, PlayError> = storage
                    .clone()
                    .execute_operation_with_messages(key, move |mut state| {
                        if state.game.normal_play_blocked() {
                            return Err(PlayError::Invalid(
                                "normal play is blocked until tribute is resolved",
                            ));
                        }
                        if !state.game.started
                            || state.game.trick_complete
                            || state.game.turn != seat
                            || indexes.is_empty()
                            || indexes.last().copied().unwrap_or(0) >= state.game.hands[seat].len()
                        {
                            return Err(PlayError::Invalid(
                                "not your turn or invalid card selection",
                            ));
                        }
                        let cards = indexes
                            .iter()
                            .map(|&i| state.game.hands[seat][i])
                            .collect::<Vec<_>>();
                        validate_play_against_table(
                            &cards,
                            &state.game.last_play,
                            state.game.level,
                        )
                        .map_err(PlayError::Invalid)?;
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
                        run_robot_turns(&mut state.game).map_err(PlayError::Invalid)?;
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
            GuandanClientMessage::TributeCard { card_index } => {
                let (key, name) = match (joined_room.clone(), joined_name.clone()) {
                    (Some(key), Some(name)) => (key, name),
                    _ => continue,
                };
                let seat = match current_seat(&storage, &key, &name).await {
                    Some(seat) => seat,
                    None => continue,
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
                let (key, name) = match (joined_room.clone(), joined_name.clone()) {
                    (Some(key), Some(name)) => (key, name),
                    _ => continue,
                };
                let seat = match current_seat(&storage, &key, &name).await {
                    Some(seat) => seat,
                    None => continue,
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
                let (key, name) = match (joined_room.clone(), joined_name.clone()) {
                    (Some(key), Some(name)) => (key, name),
                    _ => continue,
                };
                let seat = match current_seat(&storage, &key, &name).await {
                    Some(seat) => seat,
                    None => continue,
                };
                let result = storage
                    .clone()
                    .execute_operation_with_messages(key, move |mut state| {
                        let empty_table = state.game.last_player.is_none();
                        if state.game.normal_play_blocked()
                            || !state.game.started
                            || state.game.trick_complete
                            || state.game.turn != seat
                            || (empty_table && state.game.last_trick_winner.is_none())
                        {
                            return Err(());
                        }
                        if empty_table {
                            advance_turn(&mut state.game);
                            run_robot_turns(&mut state.game).map_err(|_| ())?;
                            state.bump_version();
                            return Ok((state, vec![GuandanStorageMessage::StateChanged]));
                        }
                        state.game.passes += 1;
                        let winner = state.game.last_player.unwrap_or(state.game.turn);
                        let required_passes = state
                            .game
                            .hands
                            .iter()
                            .enumerate()
                            .filter(|(index, hand)| *index != winner && !hand.is_empty())
                            .count();
                        if state.game.passes >= required_passes {
                            state.game.last_trick_winner = Some(winner);
                            state.game.turn = winner;
                            if state.game.hands[winner].is_empty() {
                                advance_turn(&mut state.game);
                            }
                            state.game.last_play.clear();
                            state.game.last_player = None;
                            state.game.table_plays.clear();
                            state.game.passes = 0;
                            state.game.trick_complete = false;
                        } else {
                            advance_turn(&mut state.game);
                        }
                        run_robot_turns(&mut state.game).map_err(|_| ())?;
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
                        state.game.last_trick_winner = Some(winner);
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
        storage
            .clone()
            .unsubscribe(key.clone(), subscriber_id)
            .await;
        if let Some(name) = joined_name {
            set_connected(&key, &name, false);
            if joined_as_observer {
                if let Ok(mut observers) = GUANDAN_OBSERVERS.lock() {
                    if let Some(room_observers) = observers.get_mut(&key) {
                        room_observers.retain(|observer| observer != &name);
                        if room_observers.is_empty() {
                            observers.remove(&key);
                        }
                    }
                }
            }
            let _: Result<u64, ()> = storage
                .clone()
                .execute_operation_with_messages(key, move |mut state| {
                    state
                        .game
                        .pending_players
                        .retain(|pending| pending != &name);
                    state.bump_version();
                    Ok((state, vec![GuandanStorageMessage::StateChanged]))
                })
                .await;
        }
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
    fn initial_draw_always_selects_a_real_player() {
        let table = validate_start(4).unwrap();
        for _ in 0..128 {
            let mut deck = build_deck(table);
            let (draw, winner) = draw_starting_seat(&mut deck, 4);
            assert_eq!(draw.len(), 4);
            assert!(winner < GUANDAN_CLASSIC_PLAYER_COUNT);
            assert!(draw.iter().all(|card| !matches!(card, CardFace::Joker(_))));
        }
    }
    #[test]
    fn accepts_even_tables_from_four_through_fourteen() {
        for count in [4usize, 6, 8, 10, 12, 14] {
            assert_eq!(validate_start(count).unwrap().player_count, count);
        }
        for count in [3usize, 5, 7, 9, 11, 13, 15] {
            assert!(validate_start(count).is_err());
        }
    }
    #[test]
    fn every_seated_player_can_start_but_observers_cannot() {
        for seat in 0..GUANDAN_CLASSIC_PLAYER_COUNT {
            assert_eq!(validate_starting_seat(Some(seat)), Ok(seat));
        }
        assert_eq!(
            validate_starting_seat(None),
            Err("observers cannot start the game")
        );
    }
    #[test]
    fn seat_reorder_command_deserializes() {
        let command: GuandanClientMessage =
            serde_json::from_str(r#"{"type":"reorder_players","order":[0,1]}"#).unwrap();
        assert!(matches!(
            command,
            GuandanClientMessage::ReorderPlayers { order: [0, 1] }
        ));
    }
    #[test]
    fn participation_command_deserializes() {
        let command: GuandanClientMessage =
            serde_json::from_str(r#"{"type":"set_participation","active":false}"#).unwrap();
        assert!(matches!(
            command,
            GuandanClientMessage::SetParticipation { active: false }
        ));
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
    fn next_round_commands_deserialize() {
        let random: GuandanClientMessage = serde_json::from_str(
            r#"{"type":"shuffle_next_round","from_position":null,"to_position":null}"#,
        )
        .unwrap();
        assert!(matches!(
            random,
            GuandanClientMessage::ShuffleNextRound {
                from_position: None,
                to_position: None
            }
        ));
        let manual: GuandanClientMessage = serde_json::from_str(
            r#"{"type":"shuffle_next_round","from_position":8,"to_position":88}"#,
        )
        .unwrap();
        assert!(matches!(
            manual,
            GuandanClientMessage::ShuffleNextRound {
                from_position: Some(8),
                to_position: Some(88)
            }
        ));
        let deal: GuandanClientMessage =
            serde_json::from_str(r#"{"type":"deal_next_round"}"#).unwrap();
        assert!(matches!(deal, GuandanClientMessage::DealNextRound));
    }
    #[test]
    fn state_message_exposes_observers_tribute_and_promotion() {
        let key = b"test-room";
        if let Ok(mut observers) = GUANDAN_OBSERVERS.lock() {
            observers.insert(key.to_vec(), vec!["Watcher".into()]);
        }
        let mut game = GuandanGameState::default();
        game.pending_tribute = Some(TributePlan::Single {
            giver: 3,
            receiver: 0,
        });
        game.last_promotion_steps = Some(1);
        let json = encode(&state_message(key, &game)).unwrap();
        assert!(json.contains("observers"));
        assert!(json.contains("Watcher"));
        assert!(json.contains("pending_tribute"));
        assert!(json.contains("last_promotion_steps"));
    }
    #[test]
    fn normalizes_room_names_for_reconnect() {
        assert_eq!(normalize_room_name(" test415/ "), "test415");
        assert_eq!(normalize_room_name("test415///"), "test415");
    }
    #[test]
    fn one_two_finish_auto_assigns_fourth_then_loser_shuffle() {
        let mut game = GuandanGameState::default();
        game.started = true;
        game.player_names = vec!["A1".into(), "B1".into(), "A2".into(), "B2".into()];
        game.hands = vec![vec![], vec![], vec![], vec![card(Suit::Clubs, Rank::Two)]];
        game.finish_order = vec![0, 2, 1];
        assert!(settle_and_redeal_if_complete(&mut game).unwrap());
        assert!(game.hands[3].is_empty());
        assert_eq!(game.finish_order, vec![0, 2, 1, 3]);
        assert_eq!(game.team_levels.team_a, Rank::Five);
        assert_eq!(game.last_promotion_steps, Some(3));
        assert_eq!(
            game.next_round_phase,
            Some(GuandanNextRoundPhase::AwaitingShuffle)
        );
        assert_eq!(game.next_round_finish_order, vec![0, 2, 1]);
        assert!(game.pending_tribute.is_none());
    }
    #[test]
    fn one_three_finish_auto_assigns_fourth_then_loser_shuffle() {
        let mut game = GuandanGameState::default();
        game.started = true;
        game.player_names = vec!["A1".into(), "B1".into(), "A2".into(), "B2".into()];
        game.hands = vec![vec![], vec![], vec![], vec![card(Suit::Clubs, Rank::Two)]];
        game.finish_order = vec![0, 1, 2];
        assert!(settle_and_redeal_if_complete(&mut game).unwrap());
        assert!(game.hands[3].is_empty());
        assert_eq!(game.finish_order, vec![0, 1, 2, 3]);
        assert_eq!(game.team_levels.team_a, Rank::Four);
        assert_eq!(game.last_promotion_steps, Some(2));
        assert_eq!(
            game.next_round_phase,
            Some(GuandanNextRoundPhase::AwaitingShuffle)
        );
        assert_eq!(game.next_round_finish_order, vec![0, 1, 2]);
        assert!(game.pending_tribute.is_none());
    }
    #[test]
    fn double_down_finishes_immediately_after_partner_is_second() {
        let mut game = GuandanGameState::default();
        game.started = true;
        game.player_names = vec!["A1".into(), "B1".into(), "A2".into(), "B2".into()];
        game.hands = vec![
            vec![],
            vec![card(Suit::Clubs, Rank::Ten)],
            vec![],
            vec![card(Suit::Spades, Rank::King)],
        ];
        game.finish_order = vec![0, 2];
        assert!(settle_and_redeal_if_complete(&mut game).unwrap());
        assert_eq!(game.finish_order, vec![0, 2, 1, 3]);
        assert!(game.hands[1].is_empty());
        assert!(game.hands[3].is_empty());
        assert_eq!(game.last_promotion_steps, Some(3));
        assert_eq!(
            game.next_round_phase,
            Some(GuandanNextRoundPhase::AwaitingShuffle)
        );
        assert!(game.last_play.is_empty());
        assert!(game.table_plays.is_empty());
    }
    #[test]
    fn current_level_single_beats_ace() {
        assert!(validate_play_against_table(
            &[card(Suit::Spades, Rank::Five)],
            &[card(Suit::Clubs, Rank::Ace)],
            Rank::Five
        )
        .is_ok());
    }
}
