from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))

# Backend room state: persist one shared threshold for every player/robot.
replace_once(
    "backend/src/guandan_serving_types.rs",
    "#[derive(Clone, Debug, Serialize, Deserialize)]\npub struct GuandanGameState {",
    "fn default_card_count_alert_threshold() -> usize {\n    6\n}\n\n#[derive(Clone, Debug, Serialize, Deserialize)]\npub struct GuandanGameState {",
)
replace_once(
    "backend/src/guandan_serving_types.rs",
    "    pub started: bool,\n    pub player_names: Vec<String>,",
    "    pub started: bool,\n    #[serde(default = \"default_card_count_alert_threshold\")]\n    pub card_count_alert_threshold: usize,\n    pub player_names: Vec<String>,",
)
replace_once(
    "backend/src/guandan_serving_types.rs",
    "            started: false,\n            player_names: Vec::new(),",
    "            started: false,\n            card_count_alert_threshold: default_card_count_alert_threshold(),\n            player_names: Vec::new(),",
)

# Backend protocol + broadcast.
replace_once(
    "backend/src/guandan_handler.rs",
    "    SetBots {\n        count: usize,\n    },",
    "    SetCardCountAlertThreshold {\n        threshold: usize,\n    },\n    SetBots {\n        count: usize,\n    },",
)
replace_once(
    "backend/src/guandan_handler.rs",
    "        maximum_players: usize,\n    },",
    "        maximum_players: usize,\n        card_count_alert_threshold: usize,\n    },",
)
replace_once(
    "backend/src/guandan_handler.rs",
    "        next_round_phase: Option<GuandanNextRoundPhase>,\n    },",
    "        next_round_phase: Option<GuandanNextRoundPhase>,\n        card_count_alert_threshold: usize,\n    },",
)
replace_once(
    "backend/src/guandan_handler.rs",
    "        maximum_players: GUANDAN_MAX_PLAYER_COUNT,\n    }",
    "        maximum_players: GUANDAN_MAX_PLAYER_COUNT,\n        card_count_alert_threshold: game.card_count_alert_threshold,\n    }",
)
replace_once(
    "backend/src/guandan_handler.rs",
    "        next_round_phase: game.next_round_phase,\n    }",
    "        next_round_phase: game.next_round_phase,\n        card_count_alert_threshold: game.card_count_alert_threshold,\n    }",
)

needle = "            GuandanClientMessage::SetBots { count } => {"
arm = '''            GuandanClientMessage::SetCardCountAlertThreshold { threshold } => {\n                let (key, name) = match (joined_room.clone(), joined_name.clone()) {\n                    (Some(key), Some(name)) => (key, name),\n                    _ => continue,\n                };\n                if current_seat(&storage, &key, &name).await.is_none() {\n                    continue;\n                }\n                let result = storage\n                    .clone()\n                    .execute_operation_with_messages(key, move |mut state| {\n                        let can_change = !state.game.started\n                            || state.game.next_round_phase\n                                == Some(GuandanNextRoundPhase::AwaitingShuffle);\n                        if !can_change || !(6..=10).contains(&threshold) {\n                            return Err(());\n                        }\n                        state.game.card_count_alert_threshold = threshold;\n                        state.bump_version();\n                        Ok((state, vec![GuandanStorageMessage::StateChanged]))\n                    })\n                    .await;\n                if result.is_err() {\n                    send(\n                        &tx,\n                        &GuandanServerMessage::Error {\n                            message: \"card count alert threshold must be 6 through 10 and can only change before a round is locked\"\n                                .to_string(),\n                        },\n                    );\n                }\n            }\n'''
replace_once("backend/src/guandan_handler.rs", needle, arm + needle)

# Frontend protocol.
replace_once(
    "frontend/src/guandanProtocol.ts",
    '  | { type: "set_bots"; count: 1 | 2 | 3 }',
    '  | { type: "set_card_count_alert_threshold"; threshold: number }\n  | { type: "set_bots"; count: 1 | 2 | 3 }',
)
replace_once(
    "frontend/src/guandanProtocol.ts",
    "      maximum_players: number;\n    }",
    "      maximum_players: number;\n      card_count_alert_threshold: number;\n    }",
)
replace_once(
    "frontend/src/guandanProtocol.ts",
    '      next_round_phase: "awaiting_shuffle" | "awaiting_deal" | null;\n    }',
    '      next_round_phase: "awaiting_shuffle" | "awaiting_deal" | null;\n      card_count_alert_threshold: number;\n    }',
)

# Frontend state.
replace_once(
    "frontend/src/GuandanStateProvider.tsx",
    "  cardsPerPlayer: number | null;\n  hand: GuandanCard[];",
    "  cardsPerPlayer: number | null;\n  cardCountAlertThreshold: number;\n  hand: GuandanCard[];",
)
replace_once(
    "frontend/src/GuandanStateProvider.tsx",
    "  cardsPerPlayer: null,\n  hand: [],",
    "  cardsPerPlayer: null,\n  cardCountAlertThreshold: 6,\n  hand: [],",
)
replace_once(
    "frontend/src/GuandanStateProvider.tsx",
    "        maximumPlayers: message.maximum_players,\n        error: null,",
    "        maximumPlayers: message.maximum_players,\n        cardCountAlertThreshold: message.card_count_alert_threshold,\n        error: null,",
)
replace_once(
    "frontend/src/GuandanStateProvider.tsx",
    "        nextRoundPhase: message.next_round_phase,\n        error: null,",
    "        nextRoundPhase: message.next_round_phase,\n        cardCountAlertThreshold: message.card_count_alert_threshold,\n        error: null,",
)

# Frontend table: remove browser-local threshold and send the shared room setting.
replace_once(
    "frontend/src/GuandanTable.tsx",
    '''  const [cardCountAlertThreshold, setCardCountAlertThreshold] =\n    React.useState<number>(() => {\n      const saved = Number(\n        window.localStorage.getItem(\"guandan_card_count_alert_threshold\") ??\n          \"6\",\n      );\n      return saved >= 6 && saved <= 10 ? saved : 6;\n    });\n''',
    "",
)
replace_once(
    "frontend/src/GuandanTable.tsx",
    '''  React.useEffect(() => {\n    window.localStorage.setItem(\n      \"guandan_card_count_alert_threshold\",\n      String(cardCountAlertThreshold),\n    );\n  }, [cardCountAlertThreshold]);\n\n''',
    "",
)
replace_once(
    "frontend/src/GuandanTable.tsx",
    '            value={cardCountAlertThreshold}\n            onChange={(event) =>\n              setCardCountAlertThreshold(Number(event.target.value))\n            }',
    '            value={state.cardCountAlertThreshold}\n            disabled={gameStarted && !nextRoundPending}\n            onChange={(event) =>\n              send({\n                type: "set_card_count_alert_threshold",\n                threshold: Number(event.target.value),\n              })\n            }',
)
replace_once(
    "frontend/src/GuandanTable.tsx",
    '''          <p>\n            牌面配色、手牌排列和报牌阈值只影响您自己，并会保存在当前浏览器。\n          </p>''',
    '''          <p>\n            报牌阈值为本桌统一设置：所有真人玩家和机器人共同使用；本轮开始后锁定，下一轮开始前可重新选择。\n          </p>\n          <p>牌面配色和手牌排列仍只影响您自己的浏览器。</p>''',
)
replace_once(
    "frontend/src/GuandanTable.tsx",
    "                    remaining <= cardCountAlertThreshold;",
    "                    remaining <= state.cardCountAlertThreshold;",
)
replace_once(
    "frontend/src/GuandanTable.tsx",
    '''                      <span\n                        className="guandan-public-card-back"\n                        aria-hidden="true"\n                      >\n                        <span>掼蛋</span>\n                      </span>''',
    '''                      <span\n                        className="guandan-public-card-back"\n                        aria-hidden="true"\n                      />''',
)

# Keep the original upper-right horizontal placement. Only make panels slightly larger,
# lighter, shoulder-to-shoulder, and use two soft team colors.
p = Path("frontend/src/guandan-public-player-position.css")
css = p.read_text()
css += r'''

/* 2026-08-26: preserve the approved upper-right row; only soften and enlarge player backs. */
html body .guandan-table:has(.guandan-public-zone) .guandan-public-player-backs {
  gap: 2px !important;
}

html body .guandan-table:has(.guandan-public-zone) .guandan-public-player-back {
  min-width: 58px !important;
  padding: 4px 5px 5px !important;
  border: 1px solid #cfd8df !important;
  border-radius: 8px !important;
  color: #24333d !important;
  box-shadow: 0 1px 3px rgb(0 0 0 / 12%) !important;
}

html body .guandan-table:has(.guandan-public-zone) .guandan-public-team-a {
  background: #f7e8e4 !important;
  border-color: #e5c8c1 !important;
}

html body .guandan-table:has(.guandan-public-zone) .guandan-public-team-b {
  background: #e8f1f6 !important;
  border-color: #c4d7e2 !important;
}

html body .guandan-table:has(.guandan-public-zone) .guandan-public-card-back {
  width: 36px !important;
  height: 50px !important;
  margin: 2px auto !important;
  border: 1px solid #bcc8d0 !important;
  border-radius: 5px !important;
  background: #fff !important;
  box-shadow: inset 0 0 0 2px #f1f4f6 !important;
}

html body .guandan-table:has(.guandan-public-zone) .guandan-public-player-seat,
html body .guandan-table:has(.guandan-public-zone) .guandan-public-player-back > strong {
  color: #263640 !important;
}

html body .guandan-table:has(.guandan-public-zone) .guandan-public-card-count {
  min-width: 24px !important;
  font-size: 0.9rem !important;
  font-weight: 900 !important;
}
'''
p.write_text(css)
