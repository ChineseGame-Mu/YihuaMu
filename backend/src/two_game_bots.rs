//! Server-controlled practice seats for Tractor and Finding Friends.
//! Isolated test implementation: no Guandan rules or production files are altered.
use slog::Logger;
use shengji_core::{
    game_state::GameState,
    interactive::{Action, InteractiveGame},
};
use shengji_mechanics::types::{Card, PlayerID};
use shengji_types::GameMessage;

const MAX_BOTS: usize = 3;
const MAX_AUTOMATIC_ACTIONS: usize = 128;

fn bot_name(index: usize) -> String {
    format!("机器人{index}")
}

fn is_bot(name: &str) -> bool {
    (1..=MAX_BOTS).any(|n| name == bot_name(n))
}

fn as_broadcasts(
    msgs: Vec<(shengji_core::interactive::BroadcastMessage, String)>,
) -> Vec<GameMessage> {
    msgs.into_iter()
        .map(|(data, message)| GameMessage::Broadcast { data, message })
        .collect()
}

/// Only the first human player may change bot seats, and only before a hand begins.
/// Registering bots through the game engine (not fake browser clients) preserves
/// player IDs and the room's existing websocket/storage rules.
pub fn configure_bots(
    game: &mut InteractiveGame,
    caller: PlayerID,
    count: usize,
    logger: &Logger,
) -> Result<Vec<GameMessage>, anyhow::Error> {
    anyhow::ensure!(count <= MAX_BOTS, "robot count must be between 0 and 3");
    let state = game.dump_state()?;
    let GameState::Initialize(phase) = state else {
        anyhow::bail!("robots can only be configured before starting a hand");
    };
    let players = &phase.propagated().players;
    let owner = players.iter().find(|p| !is_bot(&p.name));
    anyhow::ensure!(owner.is_some_and(|p| p.id == caller), "only the room owner may configure robots");

    let mut messages = Vec::new();
    for n in (count + 1)..=MAX_BOTS {
        let name = bot_name(n);
        if let Ok(pid) = game.dump_state()?.player_id(&name) {
            messages.extend(as_broadcasts(game.kick(caller, pid)?));
        }
    }
    for n in 1..=count {
        let name = bot_name(n);
        if game.dump_state()?.player_id(&name).is_err() {
            let (_, broadcasts) = game.register(name)?;
            messages.extend(as_broadcasts(broadcasts));
        }
    }
    messages.extend(run_robot_turns(game, logger));
    Ok(messages)
}

fn choose_play(
    phase: &shengji_core::game_state::play_phase::PlayPhase,
    player: PlayerID,
) -> Option<Vec<Card>> {
    let cards = phase.hands()._get_cards(player).ok()?;
    // Follow the core rules engine rather than Guandan's play comparator.
    // The first accepted candidate is a small, conservative play.
    for card in &cards {
        let choice = vec![*card];
        if phase.can_play_cards(player, &choice).is_ok() {
            return Some(choice);
        }
    }
    for i in 0..cards.len() {
        for j in (i + 1)..cards.len() {
            let choice = vec![cards[i], cards[j]];
            if phase.can_play_cards(player, &choice).is_ok() {
                return Some(choice);
            }
        }
    }
    // Larger formats (tractors, throws) require a dedicated combination search.
    None
}

fn next_robot_action(game: &InteractiveGame) -> Option<(PlayerID, Action)> {
    let state = game.dump_state().ok()?;
    match state {
        GameState::Draw(ref phase) if !phase.deck().is_empty() => {
            let player = phase.next_player().ok()?;
            is_bot(state.player_name(player).ok()?).then_some((player, Action::DrawCard))
        }
        GameState::Play(ref phase) => {
            let player = phase.next_player().ok()?;
            if !is_bot(state.player_name(player).ok()?) {
                return None;
            }
            choose_play(phase, player).map(|cards| (player, Action::PlayCards(cards)))
        }
        _ => None,
    }
}

/// Safeguard: stop at a human seat, during exchange/setup, or after bounded work.
/// Never loop indefinitely on impossible combinations or a completed trick.
pub fn run_robot_turns(game: &mut InteractiveGame, logger: &Logger) -> Vec<GameMessage> {
    let mut broadcasts = Vec::new();
    for _ in 0..MAX_AUTOMATIC_ACTIONS {
        let Some((player, action)) = next_robot_action(game) else {
            break;
        };
        match game.interact(action, player, logger) {
            Ok(messages) => broadcasts.extend(as_broadcasts(messages)),
            Err(error) => {
                slog::warn!(logger, "Robot action rejected"; "error" => %error);
                break;
            }
        }
    }
    broadcasts
}

#[cfg(test)]
mod tests {
    use super::{bot_name, is_bot};
    #[test]
    fn bot_seats_are_bounded_and_reserved() {
        assert!(is_bot(&bot_name(1)));
        assert!(is_bot(&bot_name(3)));
        assert!(!is_bot("机器人4"));
        assert!(!is_bot("普通玩家"));
    }
}
