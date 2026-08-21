import * as React from "react";

import SvgCard from "./SvgCard";
import { GuandanStateContext } from "./GuandanStateProvider";
import { GuandanWebsocketContext } from "./GuandanWebsocketProvider";
import type {
  GuandanCard,
  GuandanRank,
  GuandanTributePlan,
} from "./guandanProtocol";

const rankLabel: Record<string, string> = {
  Two: "2",
  Three: "3",
  Four: "4",
  Five: "5",
  Six: "6",
  Seven: "7",
  Eight: "8",
  Nine: "9",
  Ten: "10",
  Jack: "J",
  Queen: "Q",
  King: "K",
  Ace: "A",
};

const rankOrder: GuandanRank[] = [
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Jack",
  "Queen",
  "King",
  "Ace",
];

const suitOrder: Record<string, number> = {
  Clubs: 0,
  Diamonds: 1,
  Spades: 2,
  Hearts: 3,
};

const unicodeCards: Record<string, Record<string, string>> = {
  Diamonds: {
    Ace: "🃁",
    King: "🃎",
    Queen: "🃍",
    Jack: "🃋",
    Ten: "🃊",
    Nine: "🃉",
    Eight: "🃈",
    Seven: "🃇",
    Six: "🃆",
    Five: "🃅",
    Four: "🃄",
    Three: "🃃",
    Two: "🃂",
  },
  Clubs: {
    Ace: "🃑",
    King: "🃞",
    Queen: "🃝",
    Jack: "🃛",
    Ten: "🃚",
    Nine: "🃙",
    Eight: "🃘",
    Seven: "🃗",
    Six: "🃖",
    Five: "🃕",
    Four: "🃔",
    Three: "🃓",
    Two: "🃒",
  },
  Hearts: {
    Ace: "🂱",
    King: "🂾",
    Queen: "🂽",
    Jack: "🂻",
    Ten: "🂺",
    Nine: "🂹",
    Eight: "🂸",
    Seven: "🂷",
    Six: "🂶",
    Five: "🂵",
    Four: "🂴",
    Three: "🂳",
    Two: "🂲",
  },
  Spades: {
    Ace: "🂡",
    King: "🂮",
    Queen: "🂭",
    Jack: "🂫",
    Ten: "🂪",
    Nine: "🂩",
    Eight: "🂨",
    Seven: "🂧",
    Six: "🂦",
    Five: "🂥",
    Four: "🂤",
    Three: "🂣",
    Two: "🂢",
  },
};

const cardGlyph = (card: GuandanCard): string =>
  "Joker" in card
    ? card.Joker === "Big"
      ? "🃏"
      : "🃟"
    : (unicodeCards[card.Suited.suit]?.[card.Suited.rank] ?? "🂠");

const cardStackKey = (card: GuandanCard): string =>
  "Joker" in card ? `Joker-${card.Joker}` : card.Suited.rank;

const cardSortValue = (
  card: GuandanCard,
  level: GuandanRank | null,
): number => {
  if ("Joker" in card) return card.Joker === "Small" ? 1000 : 1100;
  const base = rankOrder.indexOf(card.Suited.rank);
  return (
    (level !== null && card.Suited.rank === level ? 900 : base * 10) +
    (suitOrder[card.Suited.suit] ?? 0)
  );
};

const tributeRole = (
  plan: GuandanTributePlan | null,
  seat: number | null,
): "giver" | "receiver" | null => {
  if (plan === null || seat === null) return null;
  if ("Single" in plan) {
    if (plan.Single.giver === seat) return "giver";
    if (plan.Single.receiver === seat) return "receiver";
    return null;
  }
  if (plan.Double.givers.includes(seat)) return "giver";
  if (plan.Double.receivers.includes(seat)) return "receiver";
  return null;
};

const DEAL_INTERVAL_MS = 120;
const TRICK_CLEAR_DELAY_MS = 8000;
const ROOM_CODE_LENGTH = 4;
const DEFAULT_ROOM_CODE = "0001";
const normalizeRoomCode = (value: string): string =>
  value.replace(/\D/g, "").slice(0, ROOM_CODE_LENGTH);
const isValidRoomCode = (value: string): boolean => /^000[1-4]$/.test(value);

const GuandanTable: React.FunctionComponent = () => {
  const { state, reset } = React.useContext(GuandanStateContext);
  const { status, send } = React.useContext(GuandanWebsocketContext);
  const query = React.useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );
  const [room, setRoom] = React.useState(() =>
    normalizeRoomCode(query.get("room") ?? DEFAULT_ROOM_CODE),
  );
  const [name, setName] = React.useState(() => query.get("name") ?? "");
  const autoJoinFromLink = React.useRef(
    query.has("room") && query.has("name") && query.get("name")!.trim() !== "",
  );
  const [selected, setSelected] = React.useState<number[]>([]);
  const [dealStep, setDealStep] = React.useState<number | null>(null);
  const [startRequested, setStartRequested] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [fourColor, setFourColor] = React.useState(
    () => window.localStorage.getItem("guandan_four_color") === "on",
  );
  const autoJoinKeyRef = React.useRef<string | null>(null);
  const joinPendingRef = React.useRef(false);
  const lastAnimatedHandSizeRef = React.useRef(0);

  const joined = state.room !== null;
  const observing = joined && state.seat === null;
  const role = tributeRole(
    state.pendingTribute as GuandanTributePlan | null,
    state.seat,
  );
  const tributePending = state.pendingTribute !== null;
  const testMode = query.get("test") === "1";
  const playerCount = state.playerCount ?? state.players.length;
  const cardsPerPlayer =
    state.cardsPerPlayer ?? (state.hand.length > 0 ? state.hand.length : 27);
  const totalDealCards = playerCount > 0 ? playerCount * cardsPerPlayer : 0;
  const dealing = dealStep !== null && dealStep < totalDealCards;
  const serverDealt =
    state.hand.length > 0 || state.handCounts.some((count) => count > 0);
  const gameStarted = serverDealt || startRequested;
  const effectiveTurn = state.turn ?? (gameStarted ? 0 : null);
  const myTurn =
    state.seat !== null &&
    effectiveTurn === state.seat &&
    gameStarted;

  React.useEffect(() => {
    window.localStorage.setItem("guandan_four_color", fourColor ? "on" : "off");
  }, [fourColor]);

  React.useEffect(() => {
    if (
      !autoJoinFromLink.current ||
      status !== "connected" ||
      joined ||
      joinPendingRef.current
    )
      return;
    const r = room.trim();
    const n = name.trim();
    if (!isValidRoomCode(r) || !n) return;
    const key = `${r}\u0000${n}`;
    if (autoJoinKeyRef.current === key) return;
    autoJoinKeyRef.current = key;
    joinPendingRef.current = true;
    if (!send({ type: "join", room: r, name: n })) {
      joinPendingRef.current = false;
      autoJoinKeyRef.current = null;
    }
  }, [status, joined, room, name, send]);

  React.useEffect(() => {
    if (joined) joinPendingRef.current = false;
  }, [joined]);

  React.useEffect(() => {
    if (status !== "connected") {
      autoJoinKeyRef.current = null;
      joinPendingRef.current = false;
    }
  }, [status]);

  React.useEffect(() => {
    if (status === "disconnected" && state.room !== null) {
      reset();
    }
  }, [status, state.room, reset]);

  React.useEffect(() => {
    if (serverDealt) setStartRequested(true);
  }, [serverDealt]);

  React.useEffect(() => {
    const previousHandSize = lastAnimatedHandSizeRef.current;
    const handSizeChanged = state.hand.length !== previousHandSize;
    if (state.hand.length < previousHandSize) {
      setSelected([]);
    }
    const shouldAnimate =
      state.hand.length > 0 &&
      handSizeChanged &&
      state.lastPlay.length === 0 &&
      playerCount >= 4;
    lastAnimatedHandSizeRef.current = state.hand.length;
    if (!shouldAnimate) return;
    setDealStep(0);
  }, [state.hand.length, state.lastPlay.length, playerCount]);

  React.useEffect(() => {
    if (dealStep === null || totalDealCards <= 0) return;
    if (dealStep >= totalDealCards) {
      setDealStep(null);
      return;
    }
    const timer = window.setTimeout(
      () =>
        setDealStep((current) =>
          current === null ? null : Math.min(current + 1, totalDealCards),
        ),
      DEAL_INTERVAL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [dealStep, totalDealCards]);

  React.useEffect(() => {
    if (
      !state.trickComplete ||
      state.lastPlayer === null ||
      state.seat !== state.lastPlayer ||
      tributePending ||
      dealing
    ) {
      return;
    }
    const timer = window.setTimeout(
      () => send({ type: "end_round" }),
      TRICK_CLEAR_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [
    state.trickComplete,
    state.lastPlayer,
    state.seat,
    tributePending,
    dealing,
    send,
  ]);

  const joinRoom = (): void => {
    const r = room.trim();
    const n = name.trim();
    if (!isValidRoomCode(r) || !n || joinPendingRef.current) return;
    autoJoinKeyRef.current = `${r}\u0000${n}`;
    autoJoinFromLink.current = true;
    joinPendingRef.current = true;
    if (!send({ type: "join", room: r, name: n })) {
      joinPendingRef.current = false;
      autoJoinKeyRef.current = null;
    }
  };

  const startGame = (): void => {
    if (state.seat !== 0 || gameStarted || state.players.length < 4) return;
    if (send({ type: "start", player_count: 4 })) {
      setStartRequested(true);
      setSelected([]);
    }
  };

  const swapSeat = (targetSeat: number): void => {
    if (gameStarted || state.seat === null || targetSeat === state.seat) return;
    send({ type: "reorder_players", order: [state.seat, targetSeat] });
  };

  const testPlayerUrl = (player: number): string => {
    const url = new URL(window.location.href);
    url.searchParams.set("game", "guandan");
    url.searchParams.set("test", "1");
    url.searchParams.set(
      "room",
      isValidRoomCode(room) ? room : DEFAULT_ROOM_CODE,
    );
    url.searchParams.set("name", `玩家${player}`);
    return url.toString();
  };

  const dealtCountForSeat = (seat: number): number => {
    if (dealStep === null || playerCount <= 0) {
      const explicit = state.handCounts[seat];
      if (explicit !== undefined) return explicit;
      if (seat === state.seat && state.hand.length > 0)
        return state.hand.length;
      return state.cardsPerPlayer ?? 0;
    }
    return Math.max(
      0,
      Math.min(
        cardsPerPlayer,
        Math.floor((dealStep + playerCount - 1 - seat) / playerCount),
      ),
    );
  };

  const visibleHand = React.useMemo(() => {
    const count =
      dealStep === null || state.seat === null
        ? state.hand.length
        : dealtCountForSeat(state.seat);
    return state.hand
      .map((card, originalIndex) => ({ card, originalIndex }))
      .filter(({ originalIndex }) => originalIndex < count)
      .sort(
        (a, b) =>
          cardSortValue(a.card, state.level) -
            cardSortValue(b.card, state.level) ||
          a.originalIndex - b.originalIndex,
      );
  }, [
    dealStep,
    state.hand,
    state.seat,
    playerCount,
    cardsPerPlayer,
    state.level,
  ]);

  const toggleCard = (index: number): void => {
    if (!gameStarted) return;
    setSelected((current) =>
      current.includes(index)
        ? current.filter((value) => value !== index)
        : [...current, index].sort((a, b) => a - b),
    );
  };

  const stackedHand = React.useMemo(() => {
    const stacks: Array<typeof visibleHand> = [];
    visibleHand.forEach((entry) => {
      const previous = stacks[stacks.length - 1];
      if (
        previous !== undefined &&
        cardStackKey(previous[0]!.card) === cardStackKey(entry.card)
      ) {
        previous.push(entry);
      } else {
        stacks.push([entry]);
      }
    });
    return stacks;
  }, [visibleHand]);

  const playSelected = (): void => {
    if (gameStarted && selected.length > 0) {
      send({ type: "play", card_indexes: selected });
    }
  };

  const sendSingleSelected = (
    type: "tribute_card" | "return_tribute",
  ): void => {
    if (
      gameStarted &&
      selected.length === 1 &&
      send({ type, card_index: selected[0] as number })
    ) {
      setSelected([]);
    }
  };

  const fullCard = (card: GuandanCard, height = 112): React.ReactNode => (
    <SvgCard card={cardGlyph(card)} height={height} fourColor={fourColor} />
  );

  return (
    <main className="guandan-table">
      <header className="guandan-status-bar">
        <h1>掼蛋</h1>
        <div>连接状态：{status}</div>
        {state.room !== null && <div>房间：{state.room}</div>}
        {state.level !== null && <div>当前级牌：{rankLabel[state.level]}</div>}
        <button
          type="button"
          className="normal"
          onClick={() => setShowSettings((value) => !value)}
        >
          ⚙ 设置
        </button>
      </header>

      {showSettings && (
        <section className="guandan-settings guandan-panel">
          <h2>掼蛋设置</h2>
          <label htmlFor="guandan-card-color-mode">牌面配色：</label>{" "}
          <select
            id="guandan-card-color-mode"
            value={fourColor ? "four" : "two"}
            onChange={(event) => setFourColor(event.target.value === "four")}
          >
            <option value="two">二色（黑 / 红）</option>
            <option value="four">四色（黑 / 红 / 蓝 / 绿）</option>
          </select>
          <p>此选择只影响您自己的牌面显示，并会保存在当前浏览器。</p>
        </section>
      )}

      {!joined && (
        <section className="guandan-join-section guandan-panel">
          <h2>加入牌桌</h2>
          <input
            aria-label="房间号"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={ROOM_CODE_LENGTH}
            placeholder="房间号0001至0004"
            value={room}
            onChange={(event) => setRoom(normalizeRoomCode(event.target.value))}
          />
          <input
            aria-label="姓名"
            placeholder="请输入完整姓名"
            maxLength={32}
            value={name}
            onChange={(event) => {
              autoJoinFromLink.current = false;
              setName(event.target.value);
            }}
          />
          <button
            disabled={
              status !== "connected" ||
              !isValidRoomCode(room) ||
              !name.trim() ||
              joinPendingRef.current
            }
            onClick={joinRoom}
          >
            加入房间
          </button>
          {status === "connected" && isValidRoomCode(room) && name.trim() && (
            <p>正在自动恢复房间…</p>
          )}
        </section>
      )}

      {testMode && !joined && (
        <section className="guandan-test-section guandan-panel">
          <h2>四人联机测试</h2>
          <div className="guandan-actions">
            {[1, 2, 3, 4].map((player) => (
              <a
                key={player}
                href={testPlayerUrl(player)}
                target="_blank"
                rel="noreferrer"
              >
                打开测试玩家 {player}
              </a>
            ))}
          </div>
        </section>
      )}

      {joined && (
        <>
          {observing && (
            <section className="guandan-observer-notice" role="status">
              您正在围观本桌。可以看到玩家、在线状态和全部桌面出牌，但不会看到任何玩家的手牌。
            </section>
          )}
          <div className="guandan-public-zone" aria-label="公共桌面">
            <div className="guandan-zone-title">
              <span>公共桌面</span>
              <small>所有玩家共同可见</small>
            </div>
            <aside className="guandan-scoreboard" aria-label="当前级数">
              <span>当前级数</span>
              <strong>
                {state.level === null ? "—" : rankLabel[state.level]}
              </strong>
            </aside>
            <section className="guandan-player-section">
              <h2>玩家</h2>
              <div className="guandan-players">
                {state.players.map((player, index) => (
                  <div
                    className={`guandan-player-card ${
                      effectiveTurn === index && gameStarted && !dealing
                        ? "is-active"
                        : ""
                    } ${index === state.seat ? "is-me" : ""}`}
                    key={`${player}-${index}`}
                  >
                    <span className="guandan-seat-badge">
                      {(["东", "南", "西", "北"] as const)[index] ?? index + 1}
                    </span>
                    <strong>
                      {index === state.seat ? `${player}（我）` : player}
                    </strong>
                    <span
                      className={`guandan-online-status ${
                        state.onlinePlayers[index] ? "is-online" : "is-offline"
                      }`}
                    >
                      {state.onlinePlayers[index] ? "● 在线" : "○ 已掉线"}
                    </span>
                    <span>
                      {effectiveTurn === index && gameStarted && !dealing
                        ? " ← 当前出牌"
                        : dealing
                          ? ` ← 发牌中 ${dealtCountForSeat(index)}/${cardsPerPlayer}`
                          : ""}
                    </span>
                    <div>剩余：{dealtCountForSeat(index)} 张</div>
                    {!gameStarted &&
                      state.seat !== null &&
                      index !== state.seat && (
                        <button
                          type="button"
                          className="normal"
                          onClick={() => swapSeat(index)}
                        >
                          与我换位
                        </button>
                      )}
                  </div>
                ))}
              </div>
              {state.observers.length > 0 && (
                <div className="guandan-observers">
                  围观：{state.observers.join("、")}
                </div>
              )}
            </section>

            {dealing && (
              <section className="guandan-notice-panel">
                <strong>正在发牌：</strong>
                按玩家1 → 玩家2 → 玩家3 → 玩家4循环发牌，请稍候…
              </section>
            )}

            {tributePending && (
              <section className="guandan-tribute-panel guandan-panel">
                <h2>进贡 / 还贡</h2>
                <p>
                  {role === "giver"
                    ? "请选择 1 张牌进贡。"
                    : role === "receiver"
                      ? "请选择 1 张牌还贡。"
                      : "等待相关玩家完成进贡与还贡。"}
                </p>
              </section>
            )}

            <section className="guandan-table-stage">
              <h2>本轮出牌</h2>
              {state.tablePlays.length === 0 ? (
                <div>暂无出牌</div>
              ) : (
                <div className="guandan-trick-plays">
                  {state.tablePlays.map((play, playIndex) => (
                    <div
                      className="guandan-trick-play"
                      key={`${play.player}-${playIndex}`}
                    >
                      <strong>
                        {state.players[play.player] ?? `玩家${play.player + 1}`}
                        ：
                      </strong>
                      <span className="guandan-table-play">
                        {play.cards.map((card, cardIndex) => (
                          <span
                            key={`${cardGlyph(card)}-${cardIndex}`}
                            style={{
                              display: "inline-block",
                              marginRight: -22,
                            }}
                          >
                            {fullCard(card, 86)}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {state.trickComplete && (
                <div>
                  <strong>本轮结束，可以收牌。</strong>{" "}
                  <button
                    type="button"
                    className="normal"
                    onClick={() => send({ type: "end_round" })}
                  >
                    结束本轮 / 收牌
                  </button>
                </div>
              )}
            </section>
          </div>

          {!observing && (
          <div className="guandan-private-zone" aria-label="我的桌面">
            <div className="guandan-zone-title">
              <span>我的桌面</span>
              <small>仅显示我的手牌与操作</small>
            </div>
            <section className="guandan-hand-section">
              <h2>我的手牌（{visibleHand.length}）</h2>
              <div className="guandan-hand">
                {stackedHand.map((stack) => (
                  <div
                    className="guandan-card-stack"
                    key={cardStackKey(stack[0]!.card)}
                  >
                    <span
                      className="guandan-stack-count"
                      aria-label={`${stack.length}张`}
                    >
                      ×{stack.length}
                    </span>
                    {stack.map(({ card, originalIndex }, stackIndex) => (
                      <button
                        type="button"
                        key={`${cardGlyph(card)}-${originalIndex}`}
                        aria-pressed={selected.includes(originalIndex)}
                        disabled={!gameStarted || state.trickComplete}
                        onClick={() => toggleCard(originalIndex)}
                        style={{
                          zIndex: selected.includes(originalIndex)
                            ? 100
                            : stackIndex + 1,
                          padding: 0,
                          border: selected.includes(originalIndex)
                            ? "3px solid currentColor"
                            : "2px solid transparent",
                          borderRadius: 8,
                          background: "transparent",
                          transform: selected.includes(originalIndex)
                            ? "translateY(-12px)"
                            : "none",
                        }}
                      >
                        {fullCard(card)}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <section className="guandan-actions guandan-play-actions">
              {!gameStarted && (
                <button
                  className="guandan-start-button"
                  disabled={state.seat !== 0 || state.players.length < 4}
                  onClick={startGame}
                >
                  开始四人局
                </button>
              )}
              {!gameStarted && state.seat !== 0 && (
                <span>等待首位玩家开始</span>
              )}
              {!gameStarted && state.players.length < 4 && (
                <span>等待四位玩家全部进入</span>
              )}
              {tributePending && role === "giver" && (
                <button
                  disabled={!gameStarted || selected.length !== 1}
                  onClick={() => sendSingleSelected("tribute_card")}
                >
                  进贡此牌
                </button>
              )}
              {tributePending && role === "receiver" && (
                <button
                  disabled={!gameStarted || selected.length !== 1}
                  onClick={() => sendSingleSelected("return_tribute")}
                >
                  还贡此牌
                </button>
              )}
              <button
                disabled={
                  !gameStarted ||
                  state.trickComplete ||
                  tributePending ||
                  !myTurn ||
                  selected.length === 0
                }
                onClick={playSelected}
              >
                出牌
              </button>
              <button
                disabled={
                  !gameStarted ||
                  state.trickComplete ||
                  tributePending ||
                  !myTurn ||
                  state.lastPlayer === null
                }
                onClick={() => send({ type: "pass" })}
              >
                过牌
              </button>
            </section>
          </div>
          )}
        </>
      )}

      {state.error !== null && <p role="alert">{state.error}</p>}
    </main>
  );
};

export default GuandanTable;
