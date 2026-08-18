//! Guandan adapter for the backend's shared versioned-room architecture.

use serde::{Deserialize, Serialize};
use shengji_core::guandan::{
    compare::beats_at_level,
    strength::strength_basic,
    team::{Team, TeamLevels},
    tribute::TributePlan,
    CardFace, Rank, Suit,
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
    pub trick_complete: bool,
    pub level: Rank,
    pub team_levels: TeamLevels,
    pub finish_order: Vec<usize>,
    pub last_game_winner: Option<usize>,
    pub last_game_winner_team: Option<Team>,
    pub last_promotion_steps: Option<usize>,
    pub pending_tribute: Option<TributePlan>,
    pub tribute_cards: Vec<GuandanTributeCard>,
    pub return_cards: Vec<GuandanTributeCard>,
    pub tribute_resisted: bool,
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

    pub fn private_hand(&self, seat: usize) -> Option<&[CardFace]> {
        self.hands.get(seat).map(Vec::as_slice)
    }

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

    fn is_wild_level_card(&self, card: CardFace) -> bool {
        matches!(card, CardFace::Suited { suit: Suit::Hearts, rank } if rank == self.level)
    }

    fn legal_tribute_card(
        &self,
        hand: &[CardFace],
        card_index: usize,
    ) -> Result<CardFace, &'static str> {
        let selected = *hand
            .get(card_index)
            .ok_or("tribute card selection is invalid")?;
        if self.is_wild_level_card(selected) {
            return Err("heart level card cannot be paid as tribute");
        }
        let selected_strength =
            strength_basic(&[selected]).ok_or("tribute card has no comparable strength")?;
        for &candidate in hand {
            if self.is_wild_level_card(candidate) {
                continue;
            }
            let candidate_strength = strength_basic(&[candidate])
                .ok_or("tribute candidate has no comparable strength")?;
            if beats_at_level(candidate_strength, selected_strength, self.level) {
                return Err("tribute must be the highest eligible card in hand");
            }
        }
        Ok(selected)
    }

    fn legal_return_card(&self, card: CardFace) -> bool {
        match card {
            CardFace::Suited { rank, .. } if rank != self.level => matches!(
                rank,
                Rank::Two
                    | Rank::Three
                    | Rank::Four
                    | Rank::Five
                    | Rank::Six
                    | Rank::Seven
                    | Rank::Eight
                    | Rank::Nine
                    | Rank::Ten
            ),
            _ => false,
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
            .get(player)
            .ok_or("tribute player seat is invalid")?;
        let card = self.legal_tribute_card(hand, card_index)?;
        self.hands
            .get_mut(player)
            .ok_or("tribute player seat is invalid")?
            .remove(card_index);
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
        let expected = self
            .tribute_givers()
            .map(|givers| givers.len())
            .ok_or("there is no pending tribute exchange")?;
        if self.tribute_cards.len() != expected {
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
            .get(player)
            .ok_or("return-card player seat is invalid")?;
        let card = *hand
            .get(card_index)
            .ok_or("return card selection is invalid")?;
        if !self.legal_return_card(card) {
            return Err("return card must be a non-level suited card ranked 2 through 10");
        }
        self.hands
            .get_mut(player)
            .ok_or("return-card player seat is invalid")?
            .remove(card_index);
        self.return_cards.push(GuandanTributeCard { player, card });
        Ok(card)
    }

    pub fn tribute_exchange_complete(&self) -> bool {
        let givers = match self.tribute_givers() {
            Some(givers) => givers.len(),
            None => return false,
        };
        let receivers = match self.tribute_receivers() {
            Some(receivers) => receivers.len(),
            None => return false,
        };
        self.tribute_cards.len() == givers && self.return_cards.len() == receivers
    }

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
                let (high_giver, high_card, low_giver, low_card) =
                    if beats_at_level(second_strength, first_strength, self.level) {
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

    fn filler() -> Vec<CardFace> {
        vec![card(Suit::Clubs, Rank::Two); 27]
    }

    #[test]
    fn guandan_uses_shared_versioned_room() {
        let room = new_guandan_room(b"test-room".to_vec());
        assert_eq!(room.game.level, Rank::Two);
        assert!(!room.game.normal_play_blocked());
    }

    #[test]
    fn pending_tribute_blocks_normal_play_until_resolved() {
        let mut state = GuandanGameState::default();
        state.pending_tribute = Some(TributePlan::Single {
            giver: 3,
            receiver: 0,
        });
        assert!(state.normal_play_blocked());
        state.clear_tribute_exchange();
        assert!(!state.normal_play_blocked());
    }

    #[test]
    fn tribute_rejects_lower_card() {
        let mut state = GuandanGameState::default();
        state.level = Rank::Five;
        state.hands = vec![
            vec![],
            vec![],
            vec![],
            vec![
                card(Suit::Clubs, Rank::King),
                card(Suit::Spades, Rank::Ace),
            ],
        ];
        state.pending_tribute = Some(TributePlan::Single {
            giver: 3,
            receiver: 0,
        });
        assert!(state.submit_tribute_card(3, 0).is_err());
        assert_eq!(
            state.submit_tribute_card(3, 1),
            Ok(card(Suit::Spades, Rank::Ace))
        );
    }

    #[test]
    fn tribute_ignores_heart_level_wild() {
        let mut state = GuandanGameState::default();
        state.level = Rank::Five;
        state.hands = vec![
            vec![],
            vec![],
            vec![],
            vec![
                card(Suit::Hearts, Rank::Five),
                card(Suit::Spades, Rank::Ace),
            ],
        ];
        state.pending_tribute = Some(TributePlan::Single {
            giver: 3,
            receiver: 0,
        });
        assert!(state.submit_tribute_card(3, 0).is_err());
        assert_eq!(
            state.submit_tribute_card(3, 1),
            Ok(card(Suit::Spades, Rank::Ace))
        );
    }

    #[test]
    fn non_heart_level_card_is_highest_eligible() {
        let mut state = GuandanGameState::default();
        state.level = Rank::Five;
        state.hands = vec![
            vec![],
            vec![],
            vec![],
            vec![
                card(Suit::Spades, Rank::Ace),
                card(Suit::Clubs, Rank::Five),
            ],
        ];
        state.pending_tribute = Some(TributePlan::Single {
            giver: 3,
            receiver: 0,
        });
        assert!(state.submit_tribute_card(3, 0).is_err());
        assert_eq!(
            state.submit_tribute_card(3, 1),
            Ok(card(Suit::Clubs, Rank::Five))
        );
    }

    #[test]
    fn return_accepts_ten_and_rejects_jack() {
        let mut state = GuandanGameState::default();
        state.level = Rank::Five;
        state.hands = vec![
            vec![
                card(Suit::Clubs, Rank::Jack),
                card(Suit::Diamonds, Rank::Ten),
            ],
            vec![],
            vec![],
            vec![],
        ];
        state.pending_tribute = Some(TributePlan::Single {
            giver: 3,
            receiver: 0,
        });
        state.tribute_cards.push(GuandanTributeCard {
            player: 3,
            card: card(Suit::Spades, Rank::Ace),
        });
        assert!(state.submit_return_card(0, 0).is_err());
        assert_eq!(
            state.submit_return_card(0, 1),
            Ok(card(Suit::Diamonds, Rank::Ten))
        );
    }

    #[test]
    fn return_rejects_level_even_below_ten() {
        let mut state = GuandanGameState::default();
        state.level = Rank::Five;
        state.hands = vec![
            vec![
                card(Suit::Clubs, Rank::Five),
                card(Suit::Clubs, Rank::Four),
            ],
            vec![],
            vec![],
            vec![],
        ];
        state.pending_tribute = Some(TributePlan::Single {
            giver: 3,
            receiver: 0,
        });
        state.tribute_cards.push(GuandanTributeCard {
            player: 3,
            card: card(Suit::Spades, Rank::Ace),
        });
        assert!(state.submit_return_card(0, 0).is_err());
        assert_eq!(
            state.submit_return_card(0, 1),
            Ok(card(Suit::Clubs, Rank::Four))
        );
    }

    #[test]
    fn single_exchange_preserves_27_and_giver_opens() {
        let tribute = card(Suit::Spades, Rank::Ace);
        let returned = card(Suit::Diamonds, Rank::Ten);
        let mut state = GuandanGameState::default();
        state.level = Rank::Five;
        state.hands = vec![filler(), filler(), filler(), filler()];
        state.hands[0][0] = returned;
        state.hands[3][0] = tribute;
        state.pending_tribute = Some(TributePlan::Single {
            giver: 3,
            receiver: 0,
        });
        state.submit_tribute_card(3, 0).unwrap();
        state.submit_return_card(0, 0).unwrap();
        state.finalize_tribute_exchange().unwrap();
        assert!(state.hands.iter().all(|hand| hand.len() == 27));
        assert_eq!(state.turn, 3);
    }

    #[test]
    fn double_exchange_preserves_27_and_high_giver_opens() {
        let low = card(Suit::Spades, Rank::King);
        let high = card(Suit::Spades, Rank::Ace);
        let first_return = card(Suit::Diamonds, Rank::Ten);
        let second_return = card(Suit::Diamonds, Rank::Nine);
        let mut state = GuandanGameState::default();
        state.level = Rank::Five;
        state.hands = vec![filler(), filler(), filler(), filler()];
        state.hands[0][0] = first_return;
        state.hands[2][0] = second_return;
        state.hands[1][0] = low;
        state.hands[3][0] = high;
        state.pending_tribute = Some(TributePlan::Double {
            givers: [1, 3],
            receivers: [0, 2],
        });
        state.submit_tribute_card(1, 0).unwrap();
        state.submit_tribute_card(3, 0).unwrap();
        state.submit_return_card(0, 0).unwrap();
        state.submit_return_card(2, 0).unwrap();
        state.finalize_tribute_exchange().unwrap();
        assert!(state.hands.iter().all(|hand| hand.len() == 27));
        assert_eq!(state.turn, 3);
    }

    #[test]
    fn finished_match_blocks_normal_play() {
        let mut state = GuandanGameState::default();
        state.match_winner = Some(Team::A);
        assert!(state.normal_play_blocked());
    }
}
