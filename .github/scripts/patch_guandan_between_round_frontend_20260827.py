from pathlib import Path

HANDLER = Path('backend/src/guandan_handler.rs')
PROTOCOL = Path('frontend/src/guandanProtocol.ts')
STATE = Path('frontend/src/GuandanStateProvider.tsx')
TABLE = Path('frontend/src/GuandanTable.tsx')


def once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)

handler = HANDLER.read_text()
handler = once(
    handler,
    '''                let tx_sub = tx.clone();
                let storage_sub = storage.clone();
                let name_sub = name;
                let key_sub = key.clone();
                subscription_task = Some(tokio::spawn(async move {''',
    '''                let tx_sub = tx.clone();
                let storage_sub = storage.clone();
                let name_sub = name;
                let key_sub = key.clone();
                let room_sub = room.clone();
                let mut announced_seat = seat;
                subscription_task = Some(tokio::spawn(async move {''',
    'capture room and announced seat',
)
handler = once(
    handler,
    '''                            let seat_sub = state
                                .game
                                .player_names
                                .iter()
                                .position(|player_name| player_name == &name_sub);
                            if state.game.started {''',
    '''                            let seat_sub = state
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
                            if state.game.started {''',
    'announce dynamic seat changes',
)
HANDLER.write_text(handler)

protocol = PROTOCOL.read_text()
protocol = once(
    protocol,
    '''      players: string[];
      observers: string[];
      online_players: boolean[];''',
    '''      players: string[];
      pending_players: string[];
      observers: string[];
      online_players: boolean[];''',
    'waiting pending players protocol',
)
protocol = once(
    protocol,
    '''      players: string[];
      observers: string[];
      online_players: boolean[];
      turn: number;''',
    '''      players: string[];
      pending_players: string[];
      observers: string[];
      online_players: boolean[];
      turn: number;''',
    'state pending players protocol',
)
PROTOCOL.write_text(protocol)

state = STATE.read_text()
state = once(
    state,
    '''  players: string[];
  observers: string[];''',
    '''  players: string[];
  pendingPlayers: string[];
  observers: string[];''',
    'state interface pending players',
)
state = once(
    state,
    '''  players: [],
  observers: [],''',
    '''  players: [],
  pendingPlayers: [],
  observers: [],''',
    'initial pending players',
)
state = once(
    state,
    '''    case "joined":
      return {
        ...initialState,
        room: message.room,
        seat: message.seat,
        error: null,
      };''',
    '''    case "joined":
      return state.room === message.room
        ? { ...state, seat: message.seat, error: null }
        : {
            ...initialState,
            room: message.room,
            seat: message.seat,
            error: null,
          };''',
    'preserve state on dynamic seat update',
)
state = once(
    state,
    '''        players: message.players,
        observers: message.observers,
        onlinePlayers: message.online_players,''',
    '''        players: message.players,
        pendingPlayers: message.pending_players,
        observers: message.observers,
        onlinePlayers: message.online_players,''',
    'waiting reducer pending players',
)
state = once(
    state,
    '''        players: message.players,
        observers: message.observers,
        onlinePlayers: message.online_players,
        hand: ownHandFinished ? [] : state.hand,''',
    '''        players: message.players,
        pendingPlayers: message.pending_players,
        observers: message.observers,
        onlinePlayers: message.online_players,
        hand: ownHandFinished ? [] : state.hand,''',
    'state reducer pending players',
)
STATE.write_text(state)

table = TABLE.read_text()
table = once(
    table,
    '''    "only the previous winner may deal": "只能由上一局赢家发牌。",
    "shuffle positions must both be between 1 and 108":''',
    '''    "only the previous winner may deal": "只能由上一局赢家发牌。",
    "participation cannot be changed in the requested state":
      "当前状态不能更改参与方式。",
    "players may only swap within the same team before start or while awaiting the next shuffle":
      "只能在开局前或下一局洗牌前，与同队玩家换位。",
    "shuffle positions must both be between 1 and 108":''',
    'new error labels',
)
table = once(
    table,
    '''  const joined = state.room !== null;
  const observing = joined && state.seat === null;''',
    '''  const joined = state.room !== null;
  const observing = joined && state.seat === null;
  const queuedForNextRound =
    observing && state.pendingPlayers.includes(name.trim());''',
    'queued status',
)
table = once(
    table,
    '''  const swapSeat = (targetSeat: number): void => {
    if (gameStarted || state.seat === null || targetSeat === state.seat) return;
    send({ type: "reorder_players", order: [state.seat, targetSeat] });
  };''',
    '''  const swapSeat = (targetSeat: number): void => {
    if (
      (gameStarted && !nextRoundPending) ||
      state.seat === null ||
      targetSeat === state.seat ||
      targetSeat % 2 !== state.seat % 2
    )
      return;
    send({ type: "reorder_players", order: [state.seat, targetSeat] });
  };''',
    'between-round same-team swap function',
)
table = once(
    table,
    '''          {observing && (
            <section className="guandan-observer-notice" role="status">
              您正在围观本桌。可以看到玩家、在线状态和全部桌面出牌，但不会看到任何玩家的手牌。
              {testMode &&''',
    '''          {observing && (
            <section className="guandan-observer-notice" role="status">
              {queuedForNextRound
                ? "您已排队等待下局加入。系统会按排队顺序每两人一组正式入座；如果暂时只有一人，会继续等待。"
                : "您正在围观本桌。可以看到玩家、在线状态和全部桌面出牌，但不会看到任何玩家的手牌。"}
              {!queuedForNextRound &&
                state.maximumPlayers !== null &&
                state.players.length + state.pendingPlayers.length <
                  state.maximumPlayers && (
                  <button
                    type="button"
                    className="normal"
                    onClick={() => send({ type: "set_participation", active: true })}
                  >
                    排队下局加入
                  </button>
                )}
              {queuedForNextRound && (
                <button
                  type="button"
                  className="normal"
                  onClick={() => send({ type: "set_participation", active: false })}
                >
                  取消排队
                </button>
              )}
              {testMode &&''',
    'observer queue controls',
)
table = once(
    table,
    '''                    {!gameStarted &&
                      state.seat !== null &&
                      index !== state.seat && (
                        <button
                          type="button"
                          className="normal"
                          onClick={() => swapSeat(index)}
                        >
                          与我换位
                        </button>
                      )}''',
    '''                    {(!gameStarted ||
                      state.nextRoundPhase === "awaiting_shuffle") &&
                      state.seat !== null &&
                      index !== state.seat &&
                      index % 2 === state.seat % 2 && (
                        <button
                          type="button"
                          className="normal"
                          onClick={() => swapSeat(index)}
                        >
                          与我换位
                        </button>
                      )}''',
    'same-team swap button visibility',
)
table = once(
    table,
    '''              {state.observers.length > 0 && (
                <div className="guandan-observers">
                  围观：{state.observers.join("、")}
                </div>
              )}
            </section>''',
    '''              {state.pendingPlayers.length > 0 && (
                <div className="guandan-observers">
                  下局排队：{state.pendingPlayers.join("、")}（每两人一组按顺序入座）
                </div>
              )}
              {state.observers.length > 0 && (
                <div className="guandan-observers">
                  围观：{state.observers.join("、")}
                </div>
              )}
            </section>''',
    'pending queue display',
)
TABLE.write_text(table)

print('BETWEEN_ROUND_FRONTEND_PATCH_OK')
