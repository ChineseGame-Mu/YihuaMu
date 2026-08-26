from pathlib import Path

backend = Path("backend/src/guandan_handler.rs")
s = backend.read_text()

old = '''fn validate_starting_seat(seat: Option<usize>) -> Result<usize, &'static str> {
    seat.ok_or("observers cannot start the game")
}
'''
new = '''fn validate_starting_seat(seat: Option<usize>) -> Result<usize, &'static str> {
    seat.ok_or("observers cannot start the game")
}
fn can_join_between_rounds(game: &GuandanGameState) -> bool {
    game.started
        && game.next_round_phase == Some(GuandanNextRoundPhase::AwaitingShuffle)
}
'''
assert old in s, "validate_starting_seat marker not found"
s = s.replace(old, new, 1)

old = '''                        if state.game.started {
                            return Err(());
                        }
                        let mut observers = GUANDAN_OBSERVERS.lock().map_err(|_| ())?;
'''
new = '''                        if state.game.started && !can_join_between_rounds(&state.game) {
                            return Err(());
                        }
                        let mut observers = GUANDAN_OBSERVERS.lock().map_err(|_| ())?;
'''
assert old in s, "set participation started guard not found"
s = s.replace(old, new, 1)

old = '''                        } else {
                            let player_index = state
                                .game
                                .player_names
                                .iter()
                                .position(|n| n == &name_for_state)
                                .ok_or(())?;
                            let removed = state.game.player_names.remove(player_index);
'''
new = '''                        } else {
                            let player_index = state
                                .game
                                .player_names
                                .iter()
                                .position(|n| n == &name_for_state)
                                .ok_or(())?;
                            if state.game.started && player_index < state.game.hands.len() {
                                return Err(());
                            }
                            let removed = state.game.player_names.remove(player_index);
'''
assert old in s, "set participation removal block not found"
s = s.replace(old, new, 1)

old = '''                if result.is_err() {
                    send(
                        &tx,
                        &GuandanServerMessage::Error {
                            message: "participation can only be changed before the game starts"
                                .to_string(),
                        },
                    );
                }
            }
            GuandanClientMessage::SetBots'''
new = '''                if result.is_err() {
                    send(
                        &tx,
                        &GuandanServerMessage::Error {
                            message: "participation can only change before start or between rounds before shuffle"
                                .to_string(),
                        },
                    );
                } else if active {
                    if let Some(seat) = current_seat(&storage, &key, &name).await {
                        send(
                            &tx,
                            &GuandanServerMessage::Joined {
                                room: String::from_utf8_lossy(&key).to_string(),
                                seat: Some(seat),
                            },
                        );
                    }
                }
            }
            GuandanClientMessage::SetBots'''
assert old in s, "set participation result block not found"
s = s.replace(old, new, 1)

marker = '''    fn accepts_even_tables_from_four_through_fourteen() {
'''
test = '''    fn between_round_joining_only_opens_before_shuffle() {
        let mut game = GuandanGameState::default();
        assert!(!can_join_between_rounds(&game));
        game.started = true;
        assert!(!can_join_between_rounds(&game));
        game.next_round_phase = Some(GuandanNextRoundPhase::AwaitingShuffle);
        assert!(can_join_between_rounds(&game));
        game.next_round_phase = Some(GuandanNextRoundPhase::AwaitingDeal);
        assert!(!can_join_between_rounds(&game));
    }
    #[test]
'''
assert marker in s, "backend tests marker not found"
s = s.replace(marker, test + marker, 1)
backend.write_text(s)

frontend = Path("frontend/src/GuandanTable.tsx")
s = frontend.read_text()

old = '''                  const shouldReport =
                    gameStarted &&
                    !dealing &&
                    remaining >= 0 &&
                    remaining <= cardCountAlertThreshold;
'''
new = '''                  const shouldReport =
                    gameStarted &&
                    !dealing &&
                    !nextRoundPending &&
                    remaining >= 0 &&
                    remaining <= cardCountAlertThreshold;
'''
assert old in s, "public card count block not found"
s = s.replace(old, new, 1)

old = '''                ))}
              </div>
              {state.observers.length > 0 && (
                <div className="guandan-observers">
                  围观：{state.observers.join("、")}
                </div>
              )}
            </section>
'''
new = '''                ))}
                {gameStarted &&
                  state.observers.map((observer, observerIndex) => (
                    <div
                      className="guandan-player-card guandan-waiting-player"
                      key={`waiting-${observer}-${observerIndex}`}
                    >
                      <span className="guandan-seat-badge">
                        {state.players.length + observerIndex + 1}
                      </span>
                      <strong>{observer}（下一局候补）</strong>
                      <span>排在现有玩家之后，本轮不拿牌、不出牌</span>
                    </div>
                  ))}
              </div>
              {!gameStarted && state.observers.length > 0 && (
                <div className="guandan-observers">
                  围观：{state.observers.join("、")}
                </div>
              )}
            </section>
'''
assert old in s, "players/observers display block not found"
s = s.replace(old, new, 1)

old = '''          {observing && (
            <section className="guandan-observer-notice" role="status">
              您正在围观本桌。可以看到玩家、在线状态和全部桌面出牌，但不会看到任何玩家的手牌。
'''
new = '''          {observing && (
            <section className="guandan-observer-notice" role="status">
              {gameStarted
                ? "您已排在现有玩家之后作为下一局候补；本轮可以看公共桌面，但不能拿牌或出牌。"
                : "您正在围观本桌。可以看到玩家、在线状态和全部桌面出牌，但不会看到任何玩家的手牌。"}
              {state.nextRoundPhase === "awaiting_shuffle" &&
                state.players.length < 14 && (
                  <button
                    type="button"
                    className="normal"
                    onClick={() =>
                      send({ type: "set_participation", active: true })
                    }
                  >
                    加入下一局（排在最后）
                  </button>
                )}
'''
assert old in s, "observer notice block not found"
s = s.replace(old, new, 1)
frontend.write_text(s)
