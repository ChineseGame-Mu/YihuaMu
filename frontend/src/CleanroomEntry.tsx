import * as React from "react";
import type { JSX } from "react";
import GuandanWebsocketProvider from "./GuandanWebsocketProvider";
import GuandanStateProvider, { GuandanStateContext } from "./GuandanStateProvider";
import GuandanTable from "./GuandanTable";
import GuandanNoBeatHint from "./GuandanNoBeatHint";
import GuandanNoBeatControls from "./GuandanNoBeatControls";
import GuandanHeaderDecor from "./GuandanHeaderDecor";
import GuandanCustomSortControls from "./GuandanCustomSortControls";
import GuandanRoundResultHud from "./GuandanRoundResultHud";
import ExitGameButton from "./ExitGameButton";
import "./cleanroom-hand-stack-fix.css";
import "./cleanroom-initial-draw-position.css";
import "./cleanroom-lobby-artwork.css";
import "./cleanroom-device-layout.css";

const supportedCounts = [4, 6, 8, 10, 12, 14] as const;
const selectableRooms = ["0001", "0002", "0003", "0004"] as const;
type SelectableRoom = (typeof selectableRooms)[number];
const cleanroomWebsocket = "wss://card-games-yihua.onrender.com/api/guandan";
const legacyUiRoom = "0001";

const isSelectableRoom = (value: string | null): value is SelectableRoom =>
  value !== null && selectableRooms.includes(value as SelectableRoom);

const roomFromLocation = (): SelectableRoom => {
  const query = new URLSearchParams(window.location.search);
  const cleanroomRoom = query.get("cleanroomRoom");
  if (isSelectableRoom(cleanroomRoom)) return cleanroomRoom;
  const pathMatch = window.location.pathname.match(/^\/room\/([^/]+)/);
  if (pathMatch !== null) {
    const fromPath = decodeURIComponent(pathMatch[1]!);
    if (isSelectableRoom(fromPath)) return fromPath;
  }
  const fromQuery = query.get("room");
  if (isSelectableRoom(fromQuery)) return fromQuery;
  return "0001";
};

const GuandanJoinBrand = (): JSX.Element => (
  <header className="cleanroom-brand" aria-label="掼蛋游戏 Guandan Game">
    <div className="cleanroom-emblem" aria-hidden="true">
      <div className="cleanroom-card-fan">
        <span className="cleanroom-fan-card cleanroom-fan-card-10">10♦</span>
        <span className="cleanroom-fan-card cleanroom-fan-card-j">J♣</span>
        <span className="cleanroom-fan-card cleanroom-fan-card-q">Q♥</span>
        <span className="cleanroom-fan-card cleanroom-fan-card-k">K♠</span>
      </div>
      <div className="cleanroom-emblem-title">掼蛋</div>
    </div>
    <h1 className="cleanroom-game-title">掼蛋游戏</h1>
    <div className="cleanroom-game-title-en">GUANDAN GAME</div>
    <p className="cleanroom-game-tagline">经典掼蛋 · 智慧对决 · 乐在其中</p>
  </header>
);

const PublicPlayerCountMarker = (): null => {
  const { state } = React.useContext(GuandanStateContext);
  const queryCount = Number(
    new URLSearchParams(window.location.search).get("players") ?? "4",
  );
  const activeCount = state.playerCount ?? queryCount;

  React.useEffect(() => {
    document.documentElement.dataset.guandanPlayerCount = String(activeCount);
    return () => {
      delete document.documentElement.dataset.guandanPlayerCount;
    };
  }, [activeCount]);

  return null;
};

const CleanroomTable = (): JSX.Element => {
  const exit = (): void => {
    const url = new URL(window.location.href);
    const actualRoom = url.searchParams.get("cleanroomRoom");
    url.searchParams.delete("game");
    url.searchParams.delete("name");
    url.searchParams.delete("players");
    url.searchParams.delete("test");
    url.searchParams.delete("ws");
    url.searchParams.delete("room");
    if (isSelectableRoom(actualRoom)) {
      url.searchParams.set("cleanroomRoom", actualRoom);
    } else {
      url.searchParams.set("cleanroomRoom", "0001");
    }
    window.location.href = url.toString();
  };

  return (
    <GuandanWebsocketProvider>
      <GuandanStateProvider>
        <PublicPlayerCountMarker />
        <ExitGameButton onClick={exit} />
        <GuandanHeaderDecor />
        <GuandanCustomSortControls />
        <GuandanTable />
        <GuandanRoundResultHud />
        <GuandanNoBeatHint />
        <GuandanNoBeatControls />
      </GuandanStateProvider>
    </GuandanWebsocketProvider>
  );
};

const CleanroomEntry = (): JSX.Element => {
  const initial = React.useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );
  const initialRoom = React.useMemo(roomFromLocation, []);
  const requested = Number(
    initial.get("playerCount") ?? initial.get("players") ?? "4",
  );
  const initialCount = supportedCounts.includes(
    requested as (typeof supportedCounts)[number],
  )
    ? requested
    : 4;
  const [roomId, setRoomId] = React.useState<SelectableRoom>(initialRoom);
  const [playerCount, setPlayerCount] = React.useState<number>(initialCount);
  const [name, setName] = React.useState(initial.get("playerName") ?? "");
  const [joined, setJoined] = React.useState(false);

  if (joined) return <CleanroomTable />;

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName === "") return;

    const url = new URL(window.location.href);
    url.searchParams.set("cleanroom", "1");
    url.searchParams.set("game", "guandan");
    url.searchParams.set("cleanroomRoom", roomId);
    url.searchParams.set("room", legacyUiRoom);
    url.searchParams.set("name", cleanName);
    url.searchParams.set("players", String(playerCount));
    url.searchParams.set("test", "1");
    url.searchParams.set("ws", cleanroomWebsocket);
    url.searchParams.delete("playerName");
    url.searchParams.delete("playerCount");
    window.history.replaceState({}, "", url.toString());
    setJoined(true);
  };

  return (
    <main className="cleanroom-join-shell">
      <div className="cleanroom-bamboo" aria-hidden="true" />
      <div className="cleanroom-plum" aria-hidden="true" />
      <div className="cleanroom-lantern" aria-hidden="true" />
      <div className="cleanroom-mountains cleanroom-mountains-left" aria-hidden="true" />
      <div className="cleanroom-mountains cleanroom-mountains-right" aria-hidden="true" />
      <div className="cleanroom-waves" aria-hidden="true" />

      <div className="cleanroom-join-content">
        <GuandanJoinBrand />
        <section className="cleanroom-join-card">
          <div className="cleanroom-card-corner cleanroom-card-corner-tl" />
          <div className="cleanroom-card-corner cleanroom-card-corner-tr" />
          <div className="cleanroom-card-corner cleanroom-card-corner-bl" />
          <div className="cleanroom-card-corner cleanroom-card-corner-br" />
          <h2>加入牌室</h2>
          <form onSubmit={submit}>
            <label htmlFor="cleanroom-room">牌室</label>
            <select
              id="cleanroom-room"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value as SelectableRoom)}
            >
              {selectableRooms.map((room) => (
                <option key={room} value={room}>
                  {room}
                </option>
              ))}
            </select>
            <label htmlFor="cleanroom-player-count">开始人数：4–14 人</label>
            <select
              id="cleanroom-player-count"
              value={playerCount}
              onChange={(event) => setPlayerCount(Number(event.target.value))}
            >
              {supportedCounts.map((count) => (
                <option key={count} value={count}>
                  {count} 人
                </option>
              ))}
            </select>
            <p className="cleanroom-note">
              第一位进入的玩家确定开始人数；之后可继续增加到 14 人。
            </p>
            <label htmlFor="cleanroom-player-name">您的姓名</label>
            <input
              id="cleanroom-player-name"
              value={name}
              maxLength={10}
              placeholder="请输入姓名"
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
            <button type="submit" disabled={name.trim() === ""}>
              <span>进入牌室</span>
              <small>ENTER ROOM</small>
            </button>
          </form>
          <p className="cleanroom-hint">
            最多四个牌室：0001、0002、0003、0004。全部使用真人。游戏开始后 3
            小时内可继续加入；人数按 6→8→10→12→14
            逐步增加，当前一局不中断，新玩家从满足偶数人数后的下一局开始参赛。
          </p>
        </section>
      </div>
    </main>
  );
};

export default CleanroomEntry;
