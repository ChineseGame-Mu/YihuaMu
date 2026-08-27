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

const guandanErrorLabel = (message: string): string => {
  const labels: Record<string, string> = {
    "selected cards are not a legal Guandan pattern":
      "当前选择不是合法的掼蛋牌型。顺子必须正好选择5张牌。",
    "play must beat the current table play": "所选牌型不能压过桌面上的牌。",
    "cannot pass now": "现在不能过牌。首位出牌者必须出牌。",
    "observers cannot start the game": "围观者不能开始游戏。",
    "the game is already underway or the requested seated player count is not ready":
      "游戏已经开始，或者所选人数尚未全部到齐。",
    "round is not ready to end": "本轮尚未结束，暂时不能收牌。",
    "the next round is not ready to shuffle": "现在还不能洗牌。",
    "only a player on the losing team may shuffle": "只能由输方玩家洗牌。",
    "the next round is not ready to deal": "请先由输方完成洗牌。",
    "only the previous winner may deal": "只能由上一局赢家发牌。",
    "participation cannot be changed in the requested state":
      "当前状态不能更改参与方式。",
    "players may only swap within the same team before start or while awaiting the next shuffle":
      "只能在开局前或下一局洗牌前，与同队玩家换位。",
    "shuffle positions must both be between 1 and 108":
      "抽牌位置和插入位置都必须在1到108之间。",
  };
  return labels[message] ?? message;
};

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
    query.get("test") !== "1" &&
      query.has("room") &&
      query.has("name") &&
      query.get("name")!.trim() !== "",
  );
  const [selected, setSelected] = React.useState<number[]>([]);
  const [dealStep, setDealStep] = React.useState<number | null>(null);
  const [startRequested, setStartRequested] = React.useState(false);
  const [showInitialDrawMini, setShowInitialDrawMini] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [shuffleFrom, setShuffleFrom] = React.useState("1");
  const [shuffleTo, setShuffleTo] = React.useState("108");
  const [fourColor, setFourColor] = React.useState(
    () => window.localStorage.getItem("guandan_four_color") === "on",
  );
  const [handSortOrder, setHandSortOrder] = React.useState<"asc" | "desc">(
    () =>
      window.localStorage.getItem("guandan_hand_sort_order") === "desc"
        ? "desc"
        : "asc",
  );
  const autoJoinKeyRef = React.useRef<string | null>(null);
  const joinPendingRef = React.useRef(false);
  const lastAnimatedHandSizeRef = React.useRef(0);
  const hasAnimatedCurrentDealRef = React.useRef(false);

  const joined = state.room !== null;
  const observing = joined && state.seat === null;
  const queuedForNextRound =
    observing && state.pendingPlayers.includes(name.trim());
  const role = tributeRole(
    state.pendingTribute as GuandanTributePlan | null,
    state.seat,
  );
  const tributePending = state.pendingTribute !== null;
  const nextRoundPending = state.nextRoundPhase !== null;
  const testMode = query.get("test") === "1";
  const supportedPlayerCounts = [4, 6, 8, 10, 12, 14] as const;
  const queryPlayerCount = Number(query.get("players") ?? "4");
  const [requestedPlayerCount, setRequestedPlayerCount] =
    React.useState<number>(
      supportedPlayerCounts.includes(
        queryPlayerCount as (typeof supportedPlayerCounts)[number],
      )
        ? queryPlayerCount
        : 4,
    );
  const playerCount = state.playerCount ?? state.players.length;
  const cardsPerPlayer =
    state.cardsPerPlayer ?? (state.hand.length > 0 ? state.hand.length : 27);
  const totalDealSteps = playerCount > 0 ? cardsPerPlayer : 0;
  const effectiveTableSize =
    playerCount > 0 ? playerCount : requestedPlayerCount;
  const deckSize = Math.max(108, effectiveTableSize * cardsPerPlayer);
  const dealing = dealStep !== null && dealStep < totalDealSteps;
  const serverDealt =
    state.hand.length > 0 || state.handCounts.some((count) => count > 0);
  const gameStarted = serverDealt || startRequested;
  const effectiveTurn = state.turn ?? (gameStarted ? 0 : null);
  const currentPlayerName =
    state.seat === null
      ? null
      : (state.players[state.seat] ?? `玩家${state.seat + 1}`);
  const lastWinnerName =
    state.lastGameWinner === null
      ? null
      : (state.players[state.lastGameWinner] ??
        `玩家${state.lastGameWinner + 1}`);
  const canShuffleNextRound =
    state.seat !== null &&
    state.lastGameWinner !== null &&
    state.seat % 2 !== state.lastGameWinner % 2;

  React.useEffect(() => {
    window.localStorage.setItem("guandan_four_color", fourColor ? "on" : "off");
  }, [fourColor]);

  React.useEffect(() => {
    window.localStorage.setItem("guandan_hand_sort_order", handSortOrder);
  }, [handSortOrder]);

  React.useEffect(() => {
    if (!gameStarted) setShuffleTo(String(deckSize));
  }, [deckSize, gameStarted]);

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
    if (
      state.initialDraw.length !== playerCount ||
      state.initialDrawWinner === null ||
      state.lastGameWinner !== null
    ) {
      setShowInitialDrawMini(false);
      return;
    }
    setShowInitialDrawMini(true);
    const timer = window.setTimeout(
      () => setShowInitialDrawMini(false),
      5 * 60 * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [
    state.initialDraw.length,
    state.initialDrawWinner,
    state.lastGameWinner,
    playerCount,
  ]);

  React.useEffect(() => {
    const previousHandSize = lastAnimatedHandSizeRef.current;
    const handSizeChanged = state.hand.length !== previousHandSize;
    if (state.hand.length < previousHandSize) {
      setSelected([]);
    }
    if (state.lastPlay.length > 0) {
      hasAnimatedCurrentDealRef.current = false;
    }
    const shouldAnimate =
      state.hand.length > 0 &&
      handSizeChanged &&
      state.lastPlay.length === 0 &&
      !nextRoundPending &&
      !hasAnimatedCurrentDealRef.current &&
      playerCount >= 4;
    lastAnimatedHandSizeRef.current = state.hand.length;
    if (!shouldAnimate) return;
    hasAnimatedCurrentDealRef.current = true;
    setDealStep(0);
  }, [state.hand.length, state.lastPlay.length, nextRoundPending, playerCount]);

  React.useEffect(() => {
    if (dealStep === null || totalDealSteps <= 0) return;
    if (dealStep >= totalDealSteps) {
      setDealStep(null);
      return;
    }
    const timer = window.setTimeout(
      () =>
        setDealStep((current) =>
          current === null ? null : Math.min(current + 1, totalDealSteps),
        ),
      DEAL_INTERVAL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [dealStep, totalDealSteps]);

  React.useEffect(() => {
    if (
      !state.trickComplete ||
      state.lastPlayer === null ||
      state.seat !== state.lastPlayer ||
      tributePending ||
      nextRoundPending ||
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
    nextRoundPending,
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
    if (
      state.seat === null ||
      gameStarted ||
      state.players.length !== requestedPlayerCount
    )
      return;
    if (send({ type: "start", player_count: requestedPlayerCount })) {
      setStartRequested(true);
      setSelected([]);
      hasAnimatedCurrentDealRef.current = true;
      setDealStep(0);
    }
  };

  const swapSeat = (targetSeat: number): void => {
    if (
      (gameStarted && !nextRoundPending) ||
      state.seat === null ||
      targetSeat === state.seat ||
      targetSeat % 2 !== state.seat % 2
    )
      return;
    send({ type: "reorder_players", order: [state.seat, targetSeat] });
  };

  const shuffleNextRound = (): void => {
    send({
      type: "shuffle_next_round",
      from_position: null,
      to_position: null,
    });
  };

  const placeCardAndShuffle = (): void => {
    const from = Number(shuffleFrom);
    const to = Number(shuffleTo);
    if (!Number.isInteger(from) || !Number.isInteger(to)) return;
    send({
      type: "shuffle_next_round",
      from_position: from,
      to_position: to,
    });
  };

  const dealNextRound = (): void => {
    setSelected([]);
    if (send({ type: "deal_next_round" })) {
      hasAnimatedCurrentDealRef.current = true;
      setDealStep(0);
    }
  };

  const testPlayerUrl = (player: number): string => {
    const url = new URL(window.location.href);
    url.searchParams.set("game", "guandan");
    url.searchParams.set("test", "1");
    url.searchParams.set(
      "room",
      isValidRoomCode(room) ? room : DEFAULT_ROOM_CODE,
    );
    url.searchParams.set("players", String(requestedPlayerCount));
    url.searchParams.set("name", `玩家${player}`);
    return url.toString();
  };

  const dealtCount = (): number => {
    if (dealStep === null || playerCount <= 0) {
      return state.cardsPerPlayer ?? 0;
    }
    return Math.max(0, Math.min(cardsPerPlayer, dealStep));
  };

  const remainingCountForSeat = (seat: number): number => {
    if (dealStep !== null) return dealtCount();
    const explicit = state.handCounts[seat];
    if (explicit !== undefined) return explicit;
    if (seat === state.seat && state.hand.length > 0) return state.hand.length;
    return state.cardsPerPlayer ?? 0;
  };

  const visibleHand = React.useMemo(() => {
    const count =
      dealStep === null || state.seat === null
        ? state.hand.length
        : dealtCount();
    const direction = handSortOrder === "asc" ? 1 : -1;
    return state.hand
      .map((card, originalIndex) => ({ card, originalIndex }))
      .filter(({ originalIndex }) => originalIndex < count)
      .sort(
        (a, b) =>
          direction *
            (cardSortValue(a.card, state.level) -
              cardSortValue(b.card, state.level)) ||
          a.originalIndex - b.originalIndex,
      );
  }, [
    dealStep,
    state.hand,
    state.seat,
    playerCount,
    cardsPerPlayer,
    state.level,
    handSortOrder,
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
          <br />
          <label htmlFor="guandan-hand-sort-order">手牌排列：</label>{" "}
          <select
            id="guandan-hand-sort-order"
            value={handSortOrder}
            onChange={(event) =>
              setHandSortOrder(event.target.value === "desc" ? "desc" : "asc")
            }
          >
            <option value="asc">从小到大</option>
            <option value="desc">从大到小</option>
          </select>
          <br />
          <label htmlFor="guandan-card-count-alert-threshold">
            报牌阈值：
          </label>{" "}
          <select
            id="guandan-card-count-alert-threshold"
            value={state.cardCountAlertThreshold}
            disabled={gameStarted && !nextRoundPending}
            onChange={(event) =>
              send({
                type: "set_card_count_alert_threshold",
                threshold: Number(event.target.value),
              })
            }
          >
            {[6, 7, 8, 9, 10].map((count) => (
              <option key={count} value={count}>
                剩余 {count} 张开始报牌
              </option>
            ))}
          </select>
          <p>
            当任一玩家手牌降到所选张数或更少时，公共桌面的玩家牌背会持续显示实时剩余张数，直到
            0 张。
          </p>
          <p>
            报牌阈值为本桌统一设置：所有真人玩家和机器人共同使用；本轮开始后锁定，下一轮开始前可重新选择。
          </p>
          <p>牌面配色和手牌排列仍只影响您自己的浏览器。</p>
          <div className="guandan-bot-settings">
            <strong>机器人陪玩：</strong>{" "}
            {[1, 2, 3].map((count) => {
              const humanCount = state.players.filter(
                (player) => !player.startsWith("机器人"),
              ).length;
              return (
                <button
                  key={count}
                  type="button"
                  className="normal"
                  disabled={
                    !joined ||
                    gameStarted ||
                    humanCount + count > requestedPlayerCount
                  }
                  onClick={() =>
                    send({ type: "set_bots", count: count as 1 | 2 | 3 })
                  }
                >
                  {count} 个机器人
                </button>
              );
            })}
          </div>
          <p>
            4至14人大桌开局前可选择 1 至 3 个机器人。
            真人加机器人总数不能超过所选桌人数。
          </p>
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
          {!testMode &&
            status === "connected" &&
            isValidRoomCode(room) &&
            name.trim() && <p>正在自动恢复房间…</p>}
        </section>
      )}

      {testMode && !joined && (
        <section className="guandan-test-section guandan-panel">
          <h2>{requestedPlayerCount}人联机测试</h2>
          <label>
            测试人数：
            <select
              value={requestedPlayerCount}
              onChange={(event) =>
                setRequestedPlayerCount(Number(event.target.value))
              }
            >
              {supportedPlayerCounts.map((count) => (
                <option key={count} value={count}>
                  {count} 人
                </option>
              ))}
            </select>
          </label>
          <p>
            测试链接会预填“玩家1、玩家2…”作为姓名；打开后可先改成真实姓名，再点“加入房间”。全部玩家加入后，会显示“抽牌决定首家并开始”按钮。
          </p>
          <div className="guandan-actions">
            {Array.from(
              { length: requestedPlayerCount },
              (_, index) => index + 1,
            ).map((player) => (
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
                    onClick={() =>
                      send({ type: "set_participation", active: true })
                    }
                  >
                    排队下局加入
                  </button>
                )}
              {queuedForNextRound && (
                <button
                  type="button"
                  className="normal"
                  onClick={() =>
                    send({ type: "set_participation", active: false })
                  }
                >
                  取消排队
                </button>
              )}
              {testMode &&
                requestedPlayerCount > 4 &&
                state.maximumPlayers !== null &&
                state.maximumPlayers < requestedPlayerCount && (
                  <strong className="guandan-test-backend-mismatch">
                    当前测试页仍连接{state.maximumPlayers}
                    人后端；请使用14人独立测试后端链接。
                  </strong>
                )}
            </section>
          )}
          <div className="guandan-public-zone" aria-label="公共桌面">
            <div className="guandan-zone-title">
              <span>公共桌面</span>
              <small>所有玩家共同可见</small>
            </div>
            {state.lastTrickWinner !== null && (
              <aside
                className="guandan-round-winner-mini"
                role="status"
                aria-label="本轮赢家"
              >
                <span>本轮赢家</span>
                <strong>
                  {state.players[state.lastTrickWinner] ??
                    `玩家${state.lastTrickWinner + 1}`}
                </strong>
              </aside>
            )}
            <div
              className="guandan-public-player-backs"
              role="status"
              aria-label="公共桌面参赛玩家牌背"
            >
              {state.players.length === 0 ? (
                <span className="guandan-public-player-empty">
                  等待玩家加入
                </span>
              ) : (
                state.players.map((player, index) => {
                  const remaining = remainingCountForSeat(index);
                  const shouldReport =
                    gameStarted &&
                    !dealing &&
                    remaining >= 0 &&
                    remaining <= state.cardCountAlertThreshold;
                  return (
                    <div
                      className={`guandan-public-player-back guandan-public-team-${
                        index % 2 === 0 ? "a" : "b"
                      } ${effectiveTurn === index && gameStarted && !dealing ? "is-active" : ""}`}
                      key={`public-back-${index}-${player}`}
                      aria-label={`${player}，队伍${index % 2 === 0 ? 1 : 2}${
                        shouldReport ? `，剩余${remaining}张` : ""
                      }`}
                    >
                      <span className="guandan-public-player-seat">
                        玩家{index + 1}
                      </span>
                      <span
                        className="guandan-public-card-back"
                        aria-hidden="true"
                      />
                      <strong title={player}>{player}</strong>
                      {shouldReport && (
                        <span
                          className="guandan-public-card-count"
                          aria-label={`剩余 ${remaining} 张`}
                        >
                          {remaining}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {state.finishOrder.length === playerCount && playerCount >= 4 && (
              <div
                className="guandan-notice-panel"
                role="status"
                aria-label="输赢顺序"
              >
                <strong>输赢顺序：</strong>
                {state.finishOrder
                  .map(
                    (seat, index) =>
                      `第${index + 1}名 ${state.players[seat] ?? `玩家${seat + 1}`}`,
                  )
                  .join(" ｜ ")}
              </div>
            )}
            {showInitialDrawMini &&
              state.initialDraw.length === playerCount &&
              state.initialDrawWinner !== null &&
              state.lastGameWinner === null && (
                <aside
                  className="guandan-initial-draw-mini"
                  role="status"
                  aria-label="首局抽牌结果"
                >
                  <strong>首局抽牌</strong>
                  <div className="guandan-initial-draw-mini-cards">
                    {state.initialDraw.map((card, index) => (
                      <div key={`initial-draw-${index}`}>
                        <span>
                          {state.players[index] ?? `玩家${index + 1}`}
                        </span>
                        {fullCard(card, 44)}
                      </div>
                    ))}
                  </div>
                  <div className="guandan-initial-draw-mini-winner">
                    首出：
                    <strong>
                      {state.players[state.initialDrawWinner] ??
                        `玩家${state.initialDrawWinner + 1}`}
                    </strong>
                  </div>
                </aside>
              )}
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
                    className={`guandan-player-card guandan-team-${
                      index % 2 === 0 ? "a" : "b"
                    } ${
                      effectiveTurn === index &&
                      gameStarted &&
                      !dealing &&
                      !nextRoundPending
                        ? "is-active"
                        : ""
                    } ${index === state.seat ? "is-me" : ""}`}
                    key={`${player}-${index}`}
                  >
                    <span
                      className="guandan-seat-badge"
                      aria-label={`玩家座位 ${index + 1}`}
                    >
                      {index + 1}
                    </span>
                    <span
                      className="guandan-team-marker"
                      aria-label={`队伍 ${index % 2 === 0 ? 1 : 2}`}
                    >
                      {index % 2 === 0 ? "1" : "2"}
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
                      {effectiveTurn === index &&
                      gameStarted &&
                      !dealing &&
                      !nextRoundPending
                        ? " ← 当前出牌"
                        : dealing
                          ? ` ← 发牌中 ${dealtCount()}/${cardsPerPlayer}`
                          : ""}
                    </span>
                    <div>
                      {nextRoundPending
                        ? "剩余：待发牌"
                        : `剩余：${remainingCountForSeat(index)} 张`}
                    </div>
                    {(!gameStarted ||
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
                      )}
                  </div>
                ))}
              </div>
              {state.pendingPlayers.length > 0 && (
                <div className="guandan-observers">
                  下局排队：{state.pendingPlayers.join("、")}
                  （每两人一组按顺序入座）
                </div>
              )}
              {state.observers.length > 0 && (
                <div className="guandan-observers">
                  围观：{state.observers.join("、")}
                </div>
              )}
            </section>

            {!gameStarted && !observing && (
              <section className="guandan-actions guandan-start-panel">
                <label>
                  本桌人数：
                  <select
                    value={requestedPlayerCount}
                    onChange={(event) =>
                      setRequestedPlayerCount(Number(event.target.value))
                    }
                  >
                    {supportedPlayerCounts.map((count) => (
                      <option key={count} value={count}>
                        {count} 人
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="guandan-start-button"
                  disabled={
                    state.seat === null ||
                    state.players.length !== requestedPlayerCount
                  }
                  onClick={startGame}
                >
                  抽牌决定首家并开始{requestedPlayerCount}人局
                </button>
                <strong>
                  {state.players.length === requestedPlayerCount
                    ? `${requestedPlayerCount}位玩家已到齐，任意已入座玩家均可开始`
                    : `等待${requestedPlayerCount}位玩家全部进入（当前${state.players.length}/${requestedPlayerCount}）`}
                </strong>
              </section>
            )}

            {dealing && (
              <section className="guandan-notice-panel">
                <strong>正在发牌：</strong>
                {playerCount}位玩家正在同步收牌，请稍候…
              </section>
            )}

            {state.finishOrder.length === playerCount && playerCount >= 4 && (
              <section
                className="guandan-notice-panel"
                role="status"
                aria-label="四位玩家输赢顺序"
              >
                <strong>四位玩家输赢顺序：</strong>
                {state.finishOrder
                  .map(
                    (seat, index) =>
                      `第${index + 1}名 ${state.players[seat] ?? `玩家${seat + 1}`}`,
                  )
                  .join(" ｜ ")}
              </section>
            )}

            {state.lastGameWinner !== null && lastWinnerName !== null && (
              <section
                className={`guandan-result-panel guandan-team-${
                  state.lastGameWinner % 2 === 0 ? "a" : "b"
                }`}
                role="status"
                aria-label="上一局结果"
              >
                <strong>上一局赢家：{lastWinnerName}</strong>
                <span>座位 {state.lastGameWinner + 1}</span>
                <span>本局积分：+{state.lastPromotionSteps ?? 0}</span>
                {state.lastPromotionSteps !== null && (
                  <span>升级 {state.lastPromotionSteps} 级</span>
                )}
              </section>
            )}

            {state.nextRoundPhase !== null && (
              <section
                className="guandan-next-round-panel"
                aria-label="下局开始"
              >
                <strong>下局开始</strong>
                {state.nextRoundPhase === "awaiting_shuffle" ? (
                  <>
                    <span>请输方任一玩家随机洗牌。</span>
                    <button
                      type="button"
                      className="normal"
                      disabled={!canShuffleNextRound}
                      onClick={shuffleNextRound}
                    >
                      随机洗牌
                    </button>
                    <div className="guandan-manual-shuffle">
                      <label>
                        抽第
                        <input
                          type="number"
                          min="1"
                          max={deckSize}
                          value={shuffleFrom}
                          disabled={!canShuffleNextRound}
                          onChange={(event) =>
                            setShuffleFrom(event.target.value)
                          }
                        />
                        张
                      </label>
                      <label>
                        插入第
                        <input
                          type="number"
                          min="1"
                          max={deckSize}
                          value={shuffleTo}
                          disabled={!canShuffleNextRound}
                          onChange={(event) => setShuffleTo(event.target.value)}
                        />
                        位
                      </label>
                      <button
                        type="button"
                        className="normal"
                        disabled={
                          !canShuffleNextRound ||
                          Number(shuffleFrom) < 1 ||
                          Number(shuffleFrom) > deckSize ||
                          Number(shuffleTo) < 1 ||
                          Number(shuffleTo) > deckSize
                        }
                        onClick={placeCardAndShuffle}
                      >
                        抽牌插入洗牌
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span>洗牌完成，请上一局赢家发牌。</span>
                    <button
                      type="button"
                      className="normal"
                      disabled={state.seat !== state.lastGameWinner}
                      onClick={dealNextRound}
                    >
                      发牌
                    </button>
                  </>
                )}
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
              {state.finishOrder.length > 0 && (
                <div
                  className="guandan-notice-panel"
                  role="status"
                  aria-label="本轮输赢排序"
                >
                  <strong>本轮输赢排序：</strong>
                  {state.finishOrder
                    .map(
                      (seat, index) =>
                        `第${index + 1}名 ${state.players[seat] ?? `玩家${seat + 1}`}`,
                    )
                    .join(" ｜ ")}
                </div>
              )}
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
            <div
              className="guandan-private-zone"
              aria-label={`我的桌面${currentPlayerName ? `｜${currentPlayerName}` : ""}`}
            >
              <div className="guandan-zone-title">
                <span>
                  我的桌面
                  {currentPlayerName !== null && `｜${currentPlayerName}`}
                </span>
                <small>仅显示我的手牌与操作</small>
              </div>
              <section className="guandan-hand-section">
                <h2>
                  {currentPlayerName !== null && `${currentPlayerName}｜`}
                  我的手牌（
                  {visibleHand.length}）
                </h2>
                <div className="guandan-hand">
                  {stackedHand.map((stack) => (
                    <div
                      className="guandan-card-stack"
                      key={cardStackKey(stack[0]!.card)}
                    >
                      {stack.map(({ card, originalIndex }, stackIndex) => (
                        <button
                          type="button"
                          key={`${cardGlyph(card)}-${originalIndex}`}
                          aria-pressed={selected.includes(originalIndex)}
                          disabled={!gameStarted}
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
                  disabled={!gameStarted || selected.length === 0}
                  onClick={playSelected}
                >
                  出牌
                </button>
                <button
                  disabled={
                    !gameStarted ||
                    (state.lastPlayer === null &&
                      state.lastTrickWinner === null)
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

      {joined &&
        !observing &&
        gameStarted &&
        !dealing &&
        !nextRoundPending &&
        !tributePending &&
        !state.trickComplete &&
        effectiveTurn !== null && (
          <div
            className="guandan-current-turn-mini"
            role="status"
            aria-label="当前应出牌玩家"
          >
            <span>当前应出牌：</span>
            <strong>
              {state.players[effectiveTurn] ?? `玩家${effectiveTurn + 1}`}
            </strong>
          </div>
        )}

      {state.error !== null && (
        <p role="alert">{guandanErrorLabel(state.error)}</p>
      )}
    </main>
  );
};

export default GuandanTable;
