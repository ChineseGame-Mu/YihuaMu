//! Conservative server-side decision policy for automated Shengji / Finding Friends players.
//! All suggested moves are checked against the authoritative game rules.
use crate::game_state::GameState;
use crate::interactive::Action;
use shengji_mechanics::types::PlayerID;

/// Returns one legal automatic action, or None when player input is required.
/// Does not inspect another player's private cards.
pub fn choose_robot_action(state: &GameState, bot: PlayerID) -> Option<Action> {
    if !state.is_player(bot) || state.next_player().ok()? != bot {
        return None;
    }
    match state {
        GameState::Draw(draw) => {
            if !draw.deck().is_empty() {
                Some(Action::DrawCard)
            } else if draw.advance(bot).is_ok() {
                Some(Action::PickUpKitty)
            } else {
                let mut trial = draw.clone();
                if trial.reveal_card().is_ok() {
                    Some(Action::RevealCard)
                } else {
                    None
                }
            }
        }
        GameState::Play(play) => {
            let cards = play.hands()._get_cards(bot).ok()?;
            // Start with a conservative single-card policy and verify each move
            // using the real trick engine, not a separate approximation.
            for card in cards.iter().copied() {
                if play.can_play_cards(bot, &[card]).is_ok() {
                    return Some(Action::PlayCards(vec![card]));
                }
            }
            // Following a multi-card lead may need a multi-card response.
            // Never submit an illegal move or expose cards to other players.
            if cards.len() <= 16 {
                for pair in cards.iter().enumerate().flat_map(|(i, a)| {
                    cards.iter().skip(i + 1).map(move |b| [*a, *b])
                }) {
                    if play.can_play_cards(bot, &pair).is_ok() {
                        return Some(Action::PlayCards(pair.to_vec()));
                    }
                }
            }
            None
        }
        GameState::Exchange(exchange) => exchange.robot_action(bot),
        GameState::Initialize(_) => None,
    }
}
