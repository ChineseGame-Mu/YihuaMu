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
            let hand = play.hands()._get_cards(bot).ok()?;
            // When following a lead, the number of cards must be identical.
            // The old implementation only considered singles and pairs.
            // This is why robots froze on tractors and 3+ card leads.
            let required = play.trick().played_cards().first()
                .map_or(1, |lead| lead.cards.len());
            if required == 0 || required > hand.len() {
                return None;
            }
            // Use suit-aware order, then the authoritative rules engine to
            // accept a move.  Never read opponents' concealed cards.
            let mut ordered = hand;
            if let Some(lead) = play.trick().played_cards().first() {
                if let Some(first) = lead.cards.first() {
                    let follow_suit = play.trick().trump().effective_suit(*first);
                    ordered.sort_by_key(|c| {
                        (play.trick().trump().effective_suit(*c) != follow_suit,
                         c.points().unwrap_or(0))
                    });
                }
            } else {
                ordered.sort_by_key(|c| c.points().unwrap_or(0));
            }
            let mut attempts = 0usize;
            search_legal_play(play, bot, &ordered, required, 0, &mut Vec::new(), &mut attempts)
                .map(Action::PlayCards)
        }
        GameState::Exchange(exchange) => exchange.robot_action(bot),
        GameState::Initialize(_) => None,
    }
}

/// Bounded multiset combination search; always validate against real Shengji
/// / Finding Friends play rules, including trick format and follow-suit.
/// A 12,000-combination cap prevents a long stall in large-card throws.
fn search_legal_play(
    play: &crate::game_state::play_phase::PlayPhase,
    actor: PlayerID,
    cards: &[shengji_mechanics::types::Card],
    required: usize,
    from: usize,
    selected: &mut Vec<shengji_mechanics::types::Card>,
    attempts: &mut usize,
) -> Option<Vec<shengji_mechanics::types::Card>> {
    if *attempts >= 12_000 {
        return None;
    }
    if selected.len() == required {
        *attempts += 1;
        // can_play_cards checks suit/format; a clone checks full play rules,
        // including special throws, before committing a server-side action.
        if play.can_play_cards(actor, selected).is_ok() {
            let mut trial = play.clone();
            if trial.play_cards(actor, selected).is_ok() {
                return Some(selected.clone());
            }
        }
        return None;
    }
    if cards.len().saturating_sub(from) < required - selected.len() {
        return None;
    }
    for i in from..cards.len() {
        if *attempts >= 12_000 {
            break;
        }
        if i > from && cards[i] == cards[i - 1] {
            continue;
        }
        selected.push(cards[i]);
        if let Some(chosen) = search_legal_play(
            play, actor, cards, required, i + 1, selected, attempts,
        ) {
            return Some(chosen);
        }
        selected.pop();
    }
    None
}
