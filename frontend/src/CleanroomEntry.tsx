import * as React from "react";
import type { JSX } from "react";
import GuandanWebsocketProvider, { cleanroomBuildCommit } from "./GuandanWebsocketProvider";
import GuandanStateProvider, { GuandanStateContext } from "./GuandanStateProvider";
import GuandanTable from "./GuandanTable";
import GuandanStartGate from "./GuandanStartGate";
import GuandanNoBeatHint from "./GuandanNoBeatHint";
import GuandanNoBeatControls from "./GuandanNoBeatControls";
import GuandanHeaderDecor from "./GuandanHeaderDecor";
import GuandanCustomSortControls from "./GuandanCustomSortControls";
import GuandanRoundResultHud from "./GuandanRoundResultHud";
import GuandanHookToBottomSetting from "./GuandanHookToBottomSetting";
import ExitGameButton from "./ExitGameButton";
import cleanroomLobbyFinalImage from "./cleanroom-lobby-final-image";
import {
  celebrationFireworks,
  formatCelebrationDateTime,
} from "./guandanMatchCelebration";
import "./cleanroom-hand-stack-fix.css";
import "./cleanroom-initial-draw-position.css";
import "./cleanroom-lobby-artwork.css";
import "./cleanroom-device-layout.css";
import "./cleanroom-public-player-names.css";
import "./guandan-real-test-20260916.css";

const supportedCounts = [4, 6, 8, 10, 12, 14] as const;
const selectableRooms = ["0001", "0002", "0003", "0004"] as const;
type SelectableRoom = (typeof selectableRooms)[number];
const cleanroomWebsocket = "wss://card-games-yihua.onrender.com/api/guandan";
const defaultCleanroomRoom: SelectableRoom = "0004";
const isSelectableRoom = (value: string | null): value is SelectableRoom => value !== null && selectableRooms.includes(value as SelectableRoom);
const roomFromLocation = (): SelectableRoom => {
  const query = new URLSearchParams(window.location.search);
  const cleanroomRoom = query.get("cleanroomRoom");
  if (isSelectableRoom(cleanroomRoom)) return cleanroomRoom;
  const pathMatch = window.location.pathname.match(/^\/room\/([^/]+)/);
  if (pathMatch !== null) { const fromPath = decodeURIComponent(pathMatch[1]!); if (isSelectableRoom(fromPath)) return fromPath; }
  const fromQuery = query.get("room");
  return isSelectableRoom(fromQuery) ? fromQuery : defaultCleanroomRoom;
};

const PublicPlayerCountMarker = (): null => {
  const { state } = React.useContext(GuandanStateContext);
  const queryCount = Number(new URLSearchParams(window.location.search).get("players") ?? "4");
  const activeCount = state.playerCount ?? queryCount;
  React.useEffect(() => { document.documentElement.dataset.guandanPlayerCount = String(activeCount); return () => { delete document.documentElement.dataset.guandanPlayerCount; }; }, [activeCount]);
  return null;
};

const CleanroomTable = (): JSX.Element => {
  const exit = (): void => {
    const url = new URL(window.location.href); const actualRoom = url.searchParams.get("cleanroomRoom");
    ["game","name","players","test","ws","room"].forEach((key) => url.searchParams.delete(key));
    url.searchParams.set("cleanroomRoom", isSelectableRoom(actualRoom) ? actualRoom : defaultCleanroomRoom); window.location.href = url.toString();
  };
  return <GuandanWebsocketProvider><GuandanStateProvider><PublicPlayerCountMarker /><ExitGameButton onClick={exit} /><GuandanHeaderDecor /><GuandanCustomSortControls /><GuandanTable /><GuandanStartGate /><GuandanRoundResultHud /><GuandanHookToBottomSetting /><GuandanNoBeatHint /><GuandanNoBeatControls /></GuandanStateProvider></GuandanWebsocketProvider>;
};

const CelebrationPreview = (): JSX.Element => {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(clock);
  }, []);
  return (
    <main
      className="guandan-match-complete-panel guandan-match-celebrating"
      role="img"
      aria-label="A级获胜全屏庆祝效果预览"
    >
      <div className="guandan-match-trophy" aria-hidden="true">🏆</div>
      <div className="guandan-fireworks" aria-hidden="true">
        {celebrationFireworks.map(([x, y, color, delay]) => (
          <i
            key={`${x}-${y}`}
            className="guandan-firework"
            style={{
              "--firework-x": x,
              "--firework-y": y,
              "--firework-color": color,
              "--firework-delay": delay,
            } as React.CSSProperties}
          />
        ))}
      </div>
      <strong>本局结束：A队打A获胜</strong>
      <span className="guandan-match-winners">获胜队员：玩家1 ｜ 玩家3 ｜ 玩家5</span>
      <time className="guandan-match-celebration-time" dateTime={now.toISOString()}>
        庆祝时间：{formatCelebrationDateTime(now)}
      </time>
      <span>🏆 庆祝焰花播放中（10秒）</span>
    </main>
  );
};

const CleanroomEntry = (): JSX.Element => {
  const initial = React.useMemo(() => new URLSearchParams(window.location.search), []);
  const showCelebrationPreview = initial.get("test") === "1" && initial.get("celebrationPreview") === "1";
  const initialRoom = React.useMemo(roomFromLocation, []);
  const requested = Number(initial.get("playerCount") ?? initial.get("players") ?? "4");
  const initialCount = supportedCounts.includes(requested as (typeof supportedCounts)[number]) ? requested : 4;
  const [roomId, setRoomId] = React.useState<SelectableRoom>(initialRoom);
  const [playerCount, setPlayerCount] = React.useState<number>(initialCount);
  const [name, setName] = React.useState(initial.get("playerName") ?? "");
  const [joined, setJoined] = React.useState(false);
  React.useEffect(() => { document.documentElement.dataset.cleanroomCommit = cleanroomBuildCommit; return () => { delete document.documentElement.dataset.cleanroomCommit; }; }, []);
  if (showCelebrationPreview) return <CelebrationPreview />;
  if (joined) return <CleanroomTable />;

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName === "") return;
    const url = new URL(window.location.href);
    url.searchParams.set("cleanroom","1");
    url.searchParams.set("game","guandan");
    url.searchParams.set("cleanroomRoom",roomId);
    url.searchParams.set("room",roomId);
    url.searchParams.set("name",cleanName);
    url.searchParams.set("players",String(playerCount));
    url.searchParams.set("test","1");
    url.searchParams.set("ws",cleanroomWebsocket);
    url.searchParams.delete("playerName");
    url.searchParams.delete("playerCount");
    window.history.replaceState({},"",url.toString());
    setJoined(true);
  };

  return (
    <main className="cleanroom-final-shell">
      <img className="cleanroom-final-backdrop" src={cleanroomLobbyFinalImage} alt="" aria-hidden="true" />
      <div className="cleanroom-final-stage">
        <img className="cleanroom-final-art" src={cleanroomLobbyFinalImage} alt="掼蛋游戏山水牌室" />
        <form className="cleanroom-final-form" onSubmit={submit} aria-label="加入牌室">
          <select id="cleanroom-room" className="cleanroom-final-control cleanroom-final-room" aria-label="牌室" value={roomId} onChange={(event) => setRoomId(event.target.value as SelectableRoom)}>{selectableRooms.map((room) => <option key={room} value={room}>{room}</option>)}</select>
          <select id="cleanroom-player-count" className="cleanroom-final-control cleanroom-final-players" aria-label="开始人数" value={playerCount} onChange={(event) => setPlayerCount(Number(event.target.value))}>{supportedCounts.map((count) => <option key={count} value={count}>{count} 人</option>)}</select>
          <input id="cleanroom-player-name" className="cleanroom-final-control cleanroom-final-name" aria-label="您的姓名" value={name} maxLength={10} placeholder="请输入姓名" autoFocus onChange={(event) => setName(event.target.value)} />
          <button id="cleanroom-enter-room" className="cleanroom-final-enter" type="submit" disabled={name.trim() === ""} aria-label="进入牌室"><span>进入牌室</span><small>ENTER ROOM</small></button>
        </form>
      </div>
    </main>
  );
};

export default CleanroomEntry;
