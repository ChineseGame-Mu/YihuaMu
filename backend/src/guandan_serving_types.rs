//! Guandan adapter for the backend's shared versioned-room architecture.
//!
//! The rule state is deliberately separate from websocket transport so the
//! Guandan game can migrate onto the same storage/subscription machinery used
//! by Shengji and Find Friends.

use serde::{Deserialize, Serialize};
use shengji_core::guandan::{
    compare::beats_at_level,
    strength::strength_basic,
    team::{Team, TeamLevels},
    tribute::TributePlan,
    CardFace, Rank,
};
use storage::State;

use crate::serving_types::VersionedRoom;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GuandanTablePlay {
    pub player: usize,
    pub cards: Vec<CardFace>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct GuandanTributeCard {
    pub player: usize,
    pub card: CardFace,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GuandanGameState {
    pub started: bool,
    pub player_names: Vec<String>,
    pub hands: Vec<Vec<CardFace>>,
    pub turn: usize,
    pub last_play: Vec<CardFace>,
    pub last_player: Option<usize>,
    pub table_plays: Vec<GuandanTablePlay>,
    pub passes: usize,
    /// True once every other active player has passed. The completed trick
    /// remains visible on the table until someone confirms "end round".
    pub trick_complete: bool,
    /// Rank currently being played. This rank is the strongest non-joker rank.
    pub level: Rank,
    /// Persistent progression for the two alternating teams across games.
    pub team_levels: TeamLevels,
    /// Players who have emptied their hands in the current game, first place first.
    pub finish_order: Vec<usize>,
    /// Winner of the most recently completed game. Preserved after the next deal.
    pub last_game_winner: Option<usize>,
    pub last_game_winner_team: Option<Team>,
    /// Number of levels awarded for the most recently completed game.
    pub last_promotion_steps: Option<usize>,
    /// Pending tribute obligations for the newly dealt game, if any.
    pub pending_tribute: Option<TributePlan>,
    /// Tribute cards already submitted by the obligated giver seats.
    pub tribute_cards: Vec<GuandanTributeCard>,
    /// Return cards already selected by the receiving seats.
    pub return_cards: Vec<GuandanTributeCard>,
    /// True when the pending tribute was cancelled by the big-joker resistance rule.
    pub tribute_resisted: bool,
    /// Final winner of the whole match. A team must win while already playing A.
    /// Once set, no automatic redeal occurs and normal play is stopped.
    pub match_winner: Option<Team>,
}

impl Default for GuandanGameState {
    fn default() -> Self {
        Self {
            started: false,
            player_names: Vec::new(),
            hands: Vec::new(),
            turn: 0,
            last_play: Vec::new(),
            last_player: None,
            table_plays: Vec::new(),
            passes: 0,
            trick_complete: false,
            level: Rank::Two,
            team_levels: TeamLevels::default(),
            finish_order: Vec::new(),
            last_game_winner: None,
            last_game_winner_team: None,
            last_promotion_steps: None,
            pending_tribute: None,
            tribute_cards: Vec::new(),
            return_cards: Vec::new(),
            tribute_resisted: false,
            match_winner: None,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum GuandanStorageMessage {
    StateChanged,
}

impl GuandanGameState {
    pub fn hand_counts(&self) -> Vec<usize> {
        self.hands.iter().map(Vec::len).collect()
    }

    /// Produce the private hand payload for one seat. Public table state is
    /// broadcast separately; another player's cards are never returned here.
    pub fn private_hand(&self, seat: usize) -> Option<&[CardFace]> {
        self.hands.get(seat).map(Vec::as_slice)
    }

    /// Normal trick play must pause while a tribute exchange is outstanding.
    /// A resisted tribute has no pending plan, so play may continue normally.
    pub fn normal_play_blocked(&self) -> bool {
        self.pending_tribute.is_some() || self.match_winner.is_some()
    }

    fn tribute_givers(&self) -> Option<Vec<usize>> {
        match self.pending_tribute.as_ref()? {
            TributePlan::Single { giver, .. } => Some(vec![*giver]),
            TributePlan::Double { givers, .. } => Some(givers.to_vec()),
        }
    }

    fn tribute_receivers(&self) -> Option<Vec<usize>> {
        match self.pending_tribute.as_ref()? {
            TributePlan::Single { receiver, .. } => Some(vec![*receiver]),
            TributePlan::Double { receivers, .. } => Some(receivers.to_vec()),
        }
    }

    pub fn submit_tribute_card(
        &mut self,
        player: usize,
        card_index: usize,
    ) -> Result<CardFace, &'static str> {
        let givers = self
            .tribute_givers()
            .ok_or("there is no pending tribute exchange")?;
        if !givers.contains(&player) {
            return Err("this player is not required to pay tribute");
        }
        if self.tribute_cards.iter().any(|entry| entry.player == player) {
            return Err("this player has already submitted a tribute card");
        }
        let hand = self
            .hands
            .get_mut(player)
            .ok_or("tribute player seat is invalid")?;
        if card_index >= hand.len() {
            return Err("tribute card selection is invalid");
        }
        let card = hand.remove(card_index);
        self.tribute_cards.push(GuandanTributeCard { player, card });
        Ok(card)
    }

    pub fn submit_return_card(
        &mut self,
        player: usize,
        card_index: usize,
    ) -> Result<CardFace, &'static str> {
        let receivers = self
            .tribute_receivers()
            .ok_or("there is no pending tribute exchange")?;
        let expected_tribute_count = self
            .tribute_givers()
            .map(|givers| givers.len())
            .ok_or("there is no pending tribute exchange")?;
        if self.tribute_cards.len() != expected_tribute_count {
            return Err("all tribute cards must be submitted before return cards");
        }
        if !receivers.contains(&player) {
            return Err("this player is not required to return a card");
        }
        if self.return_cards.iter().any(|entry| entry.player == player) {
            return Err("this player has already submitted a return card");
        }
        let hand = self
            .hands
            .get_mut(player)
            .ok_or("return-card player seat is invalid")?;
        if card_index >= hand.len() {
            return Err("return card selection is invalid");
        }
        let card = hand.remove(card_index);
        self.return_cards.push(GuandanTributeCard { player, card });
        Ok(card)
    }

    pub fn tribute_exchange_complete(&self) -> bool {
        let giver_count = match self.tribute_givers() {
            Some(givers) => givers.len(),
            None => return false,
        };
        let receiver_count = match self.tribute_receivers() {
            Some(receivers) => receivers.len(),
            None => return false,
        };
        self.tribute_cards.len() == giver_count && self.return_cards.len() == receiver_count
    }

    /// Move submitted tribute cards to the receiving hands and move each
    /// receiver's return card back to the giver whose tribute that receiver got.
    /// The player who paid the top tribute leads the first trick after exchange.
    pub fn finalize_tribute_exchange(&mut self) -> Result<(), &'static str> {
        if !self.tribute_exchange_complete() {
            return Err("tribute exchange is not complete");
        }
        let plan = self
            .pending_tribute
            .clone()
            .ok_or("there is no pending tribute exchange")?;
        let tribute_cards = self.tribute_cards.clone();
        let return_cards = self.return_cards.clone();

        match plan {
            TributePlan::Single { giver, receiver } => {
                let tribute = tribute_cards
                    .iter()
                    .find(|entry| entry.player == giver)
                    .ok_or("missing single tribute card")?
                    .card;
                let returned = return_cards
                    .iter()
                    .find(|entry| entry.player == receiver)
                    .ok_or("missing single return card")?
                    .card;
                self.hands
                    .get_mut(receiver)
                    .ok_or("tribute receiver seat is invalid")?
                    .push(tribute);
                self.hands
                    .get_mut(giver)
                    .ok_or("tribute giver seat is invalid")?
                    .push(returned);
                self.turn = giver;
            }
            TributePlan::Double { givers, receivers } => {
                let first = tribute_cards
                    .iter()
                    .find(|entry| entry.player == givers[0])
                    .ok_or("missing first double tribute card")?;
                let second = tribute_cards
                    .iter()
                    .find(|entry| entry.player == givers[1])
                    .ok_or("missing second double tribute card")?;
                let first_strength = strength_basic(&[first.card])
                    .ok_or("first tribute card has no comparable strength")?;
                let second_strength = strength_basic(&[second.card])
                    .ok_or("second tribute card has no comparable strength")?;
                let second_is_stronger = beats_at_level(second_strength, first_strength, self.level);
                let (high_giver, high_card, low_giver, low_card) = if second_is_stronger {
                    (second.player, second.card, first.player, first.card)
                } else {
                    (first.player, first.card, second.player, second.card)
                };

                let first_return = return_cards
                    .iter()
                    .find(|entry| entry.player == receivers[0])
                    .ok_or("missing first double return card")?
                    .card;
                let second_return = return_cards
                    .iter()
                    .find(|entry| entry.player == receivers[1])
                    .ok_or("missing second double return card")?
                    .card;

                self.hands
                    .get_mut(receivers[0])
                    .ok_or("first tribute receiver seat is invalid")?
                    .push(high_card);
                self.hands
                    .get_mut(high_giver)
                    .ok_or("high tribute giver seat is invalid")?
                    .push(first_return);
                self.hands
                    .get_mut(receivers[1])
                    .ok_or("second tribute receiver seat is invalid")?
                    .push(low_card);
                self.hands
                    .get_mut(low_giver)
                    .ok_or("low tribute giver seat is invalid")?
                    .push(second_return);
                self.turn = high_giver;
            }
        }

        self.clear_tribute_exchange();
        Ok(())
    }

    pub fn clear_tribute_exchange(&mut self) {
        self.pending_tribute = None;
        self.tribute_cards.clear();
        self.return_cards.clear();
    }
}

pub type VersionedGuandanGame = VersionedRoom<GuandanGameState>;

impl State for VersionedGuandanGame {
    type Message = GuandanStorageMessage;

    fn version(&self) -> u64 {
        self.monotonic_id
    }

    fn key(&self) -> &[u8] {
        &self.room_name
    }

    fn new_from_key(key: Vec<u8>) -> Self {
        new_guandan_room(key)
    }
}

pub fn new_guandan_room(room_name: Vec<u8>) -> VersionedGuandanGame {
    VersionedRoom::with_game(room_name, GuandanGameState::default())
}

#[cfg(test)]
mod tests {
    use super::*;
    use shengji_core::guandan::{team::Team, tribute::TributePlan, Rank, Suit};

    fn card(suit: Suit, rank: Rank) -> CardFace {
        CardFace::Suited { suit, rank }
    }

    #[test]
    fn guandan_uses_shared_versioned_room() {
        let room = new_guandan_room(b"test-room".to_vec());
        assert_eq!(room.monotonic_id, 0);
        assert!(!room.game.started);
        assert!(!room.game.trick_complete);
        assert_eq!(room.game.level, Rank::Two);
        assert_eq!(room.game.team_levels.level_for(Team::A), Rank::Two);
        assert_eq!(room.game.team_levels.level_for(Team::B), Rank::Two);
        assert!(room.game.finish_order.is_empty());
        assert_eq!(room.game.last_game_winner, None);
        assert_eq!(room.game.last_game_winner_team, None);
        assert_eq!(room.game.last_promotion_steps, None);
        assert_eq!(room.game.pending_tribute, None);
        assert!(room.game.tribute_cards.is_empty());
        assert!(room.game.return_cards.is_empty());
        assert!(!room.game.tribute_resisted);
        assert_eq!(room.game.match_winner, None);
        assert!(!room.game.normal_play_blocked());
        assert!(room.associated_websockets.is_empty());
        assert_eq!(room.key(), b"test-room");
    }

    #[test]
    fn private_hand_does_not_expose_other_seats() {
        let c1 = card(Suit::Clubs, Rank::Two);
        let c2 = card(Suit::Hearts, Rank::Ace);
        let mut state = GuandanGameState::default();
        state.hands = vec![vec![c1], vec![c2]];
        assert_eq!(state.private_hand(0), Some(&[c1][..]));
        assert_eq!(state.private_hand(1), Some(&[c2][..]));
        assert_eq!(state.private_hand(2), None);
    }

    #[test]
    fn pending_tribute_blocks_normal_play_until_resolved() {
        let mut state = GuandanGameState::default();
        state.pending_tribute = Some(TributePlan::Single { giver: 3, receiver: 0 });
        assert!(state.normal_play_blocked());
        state.clear_tribute_exchange();
        state.tribute_resisted = true;
        assert!(!state.normal_play_blocked());
    }

    #[test]
    fn tribute_exchange_cards_can_be_cleared_together() {
        let c = card(Suit::Spades, Rank::Ace);
        let mut state = GuandanGameState::default();
        state.pending_tribute = Some(TributePlan::Single { giver: 3, receiver: 0 });
        state.tribute_cards.push(GuandanTributeCard { player: 3, card: c });
        state.return_cards.push(GuandanTributeCard { player: 0, card: c });
        state.clear_tribute_exchange();
        assert_eq!(state.pending_tribute, None);
        assert!(state.tribute_cards.is_empty());
        assert!(state.return_cards.is_empty());
    }

    #[test]
    fn single_tribute_submission_enforces_roles_order_and_opening_turn() {
        let tribute = card(Suit::Spades, Rank::Ace);
        let returned = card(Suit::Clubs, Rank::Three);
        let mut state = GuandanGameState::default();
        state.hands = vec![vec![returned], vec![], vec![], vec![tribute]];
        state.pending_tribute = Some(TributePlan::Single { giver: 3, receiver: 0 });

        assert!(state.submit_return_card(0, 0).is_err());
        assert!(state.submit_tribute_card(0, 0).is_err());
        assert_eq!(state.submit_tribute_card(3, 0), Ok(tribute));
        assert!(state.submit_tribute_card(3, 0).is_err());
        assert_eq!(state.submit_return_card(0, 0), Ok(returned));
        assert!(state.tribute_exchange_complete());
        assert!(state.finalize_tribute_exchange().is_ok());
        assert_eq!(state.pending_tribute, None);
        assert_eq!(state.hands[0], vec![tribute]);
        assert_eq!(state.hands[3], vec![returned]);
        assert_eq!(state.turn, 3);
        assert!(!state.normal_play_blocked());
    }

    #[test]
    fn double_tribute_requires_roles_and_top_tribute_opens() {
        let low_tribute = card(Suit::Clubs, Rank::Nine);
        let high_tribute = card(Suit::Spades, Rank::Ace);
        let first_return = card(Suit::Clubs, Rank::Three);
        let second_return = card(Suit::Diamonds, Rank::Four);
        let mut state = GuandanGameState::default();
        state.hands = vec![
            vec![first_return],
            vec![low_tribute],
            vec![second_return],
            vec![high_tribute],
        ];
        state.pending_tribute = Some(TributePlan::Double {
            givers: [1, 3],
            receivers: [0, 2],
        });

        assert!(state.submit_tribute_card(1, 0).is_ok());
        assert!(state.submit_return_card(0, 0).is_err());
        assert!(state.submit_tribute_card(3, 0).is_ok());
        assert!(state.submit_return_card(0, 0).is_ok());
        assert!(state.submit_return_card(2, 0).is_ok());
        assert!(state.tribute_exchange_complete());
        assert!(state.finalize_tribute_exchange().is_ok());
        assert_eq!(state.pending_tribute, None);
        assert_eq!(state.hands[0], vec![high_tribute]);
        assert_eq!(state.hands[2], vec![low_tribute]);
        assert_eq!(state.hands[3], vec![first_return]);
        assert_eq!(state.hands[1], vec![second_return]);
        assert_eq!(state.turn, 3);
    }

    #[test]
    fn equal_double_tribute_uses_first_mapped_giver_as_opener() {
        let first_tribute = card(Suit::Clubs, Rank::Ace);
        let second_tribute = card(Suit::Spades, Rank::Ace);
        let first_return = card(Suit::Clubs, Rank::Three);
        let second_return = card(Suit::Diamonds, Rank::Four);
        let mut state = GuandanGameState::default();
        state.hands = vec![
            vec![first_return],
            vec![first_tribute],
            vec![second_return],
            vec![second_tribute],
        ];
        state.pending_tribute = Some(TributePlan::Double {
            givers: [1, 3],
            receivers: [0, 2],
        });
        state.submit_tribute_card(1, 0).unwrap();
        state.submit_tribute_card(3, 0).unwrap();
        state.submit_return_card(0, 0).unwrap();
        state.submit_return_card(2, 0).unwrap();
        state.finalize_tribute_exchange().unwrap();
        assert_eq!(state.turn, 1);
    }

    #[test]
    fn finished_match_blocks_normal_play() {
        let mut state = GuandanGameState::default();
        state.match_winner = Some(Team::A);
        assert!(state.normal_play_blocked());
    }
}
