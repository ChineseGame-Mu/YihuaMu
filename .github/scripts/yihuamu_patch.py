from pathlib import Path
import re


def sub1(text, pattern, repl, label):
    out, n = re.subn(pattern, repl, text, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f"{label}: expected 1 match, found {n}")
    return out


p = Path("mechanics/src/trick.rs")
s = p.read_text()

s = sub1(
    s,
    r"    pub fn is_legal_play\(\n        &self,\n        hand: &HashMap<Card, usize>,\n        proposed: &'_ \[Card\],\n        trick_draw_policy: TrickDrawPolicy,\n        bomb_policy: BombPolicy,\n    \) -> bool \{\n",
    """    pub fn is_legal_play(\n        &self,\n        hand: &HashMap<Card, usize>,\n        proposed: &'_ [Card],\n        trick_draw_policy: TrickDrawPolicy,\n        bomb_policy: BombPolicy,\n    ) -> bool {\n        self.is_legal_play_with_yihuamu_rule(hand, proposed, trick_draw_policy, bomb_policy, false)\n    }\n\n    pub fn is_legal_play_with_yihuamu_rule(\n        &self,\n        hand: &HashMap<Card, usize>,\n        proposed: &'_ [Card],\n        trick_draw_policy: TrickDrawPolicy,\n        bomb_policy: BombPolicy,\n        yihuamu_four_deck_rule: bool,\n    ) -> bool {\n""",
    "legal header",
)

s = sub1(
    s,
    r"        if num_proposed_correct_suit < required \{\n            let num_correct_suit = num_correct_suit_in_hand\(\);\n            // If this is all of the correct suit that is available, it's fine\n            // Otherwise, this is an invalid play\.\n            num_correct_suit == num_proposed_correct_suit\n        \} else \{",
    """        if num_proposed_correct_suit < required {\n            let num_correct_suit = num_correct_suit_in_hand();\n            let has_pair_plus_single = yihuamu_four_deck_rule\n                && required == 4\n                && num_correct_suit == 3\n                && hand.iter().any(|(c, ct)| {\n                    self.trump.effective_suit(*c) == self.suit && *ct == 2\n                });\n            if has_pair_plus_single && num_proposed_correct_suit == 2 {\n                return true;\n            }\n            num_correct_suit == num_proposed_correct_suit\n        } else {""",
    "short suit block",
)

marker = "    // ---- Bug regression tests ----\n"
test = r'''    #[test]
    fn test_yihuamu_four_deck_three_card_suit_pair_may_be_split() {
        let trick_format = TrickFormat::from_cards(
            TRUMP,
            TractorRequirements::default(),
            &[H_6, H_6, H_7, H_7],
            None,
            CompoundFormats::default(),
        ).unwrap();
        let hand = Card::count(vec![H_9, H_9, H_J, C_2, D_2, C_3]);
        let split_pair_play = [H_9, H_J, C_2, D_2];
        assert!(!trick_format.is_legal_play(&hand, &split_pair_play, TrickDrawPolicy::NoProtections, BombPolicy::NoBombs));
        assert!(trick_format.is_legal_play_with_yihuamu_rule(&hand, &split_pair_play, TrickDrawPolicy::NoProtections, BombPolicy::NoBombs, true));
        assert!(!trick_format.is_legal_play_with_yihuamu_rule(&hand, &[H_J, C_2, D_2, C_3], TrickDrawPolicy::NoProtections, BombPolicy::NoBombs, true));
        let triple = Card::count(vec![H_9, H_9, H_9, C_2, D_2]);
        assert!(!trick_format.is_legal_play_with_yihuamu_rule(&triple, &[H_9, H_9, C_2, D_2], TrickDrawPolicy::NoProtections, BombPolicy::NoBombs, true));
    }

'''
if marker not in s:
    raise SystemExit("test marker missing")
s = s.replace(marker, test + marker, 1)

s = sub1(
    s,
    r"    pub fn can_play_cards\(\n        &self,\n        id: PlayerID,\n        hands: &Hands,\n        cards: &\[Card\],\n        trick_draw_policy: TrickDrawPolicy,\n        compound_formats: CompoundFormats,\n    \) -> Result<\(\), TrickError> \{\n        hands\.contains\(id, cards\.iter\(\)\.cloned\(\)\)\?;",
    """    pub fn can_play_cards(\n        &self,\n        id: PlayerID,\n        hands: &Hands,\n        cards: &[Card],\n        trick_draw_policy: TrickDrawPolicy,\n        compound_formats: CompoundFormats,\n    ) -> Result<(), TrickError> {\n        self.can_play_cards_with_yihuamu_rule(id, hands, cards, trick_draw_policy, compound_formats, false)\n    }\n\n    pub fn can_play_cards_with_yihuamu_rule(\n        &self,\n        id: PlayerID,\n        hands: &Hands,\n        cards: &[Card],\n        trick_draw_policy: TrickDrawPolicy,\n        compound_formats: CompoundFormats,\n        yihuamu_four_deck_rule: bool,\n    ) -> Result<(), TrickError> {\n        hands.contains(id, cards.iter().cloned())?;""",
    "can play header",
)

s = sub1(
    s,
    r"if tf\.is_legal_play\(hands\.get\(id\)\?, cards, trick_draw_policy, self\.bomb_policy\) \{",
    "if tf.is_legal_play_with_yihuamu_rule(hands.get(id)?, cards, trick_draw_policy, self.bomb_policy, yihuamu_four_deck_rule) {",
    "legal call",
)
p.write_text(s)

p = Path("core/src/game_state/play_phase.rs")
s = p.read_text()
s = sub1(
    s,
    r"        Ok\(self\.trick\.can_play_cards\(\n            id,\n            &self\.hands,\n            cards,\n            self\.propagated\.trick_draw_policy,\n            self\.propagated\.compound_formats\.clone\(\),\n        \)\?\)",
    """        Ok(self.trick.can_play_cards_with_yihuamu_rule(\n            id,\n            &self.hands,\n            cards,\n            self.propagated.trick_draw_policy,\n            self.propagated.compound_formats.clone(),\n            self.num_decks == 4,\n        )?)""",
    "core can play",
)
p.write_text(s)
