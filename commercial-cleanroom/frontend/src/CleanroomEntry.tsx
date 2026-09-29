import * as React from "react";
import GuandanTable from "./GuandanTable";
import GuandanWebsocketProvider from "./GuandanWebsocketProvider";
import GuandanStateProvider from "./GuandanStateProvider";

const supportedCounts = [4, 6, 8, 10, 12, 14] as const;
const cleanroomWebsocket = "wss://chinesegame-yihua.onrender.com/api/guandan";

const CleanroomEntry: React.FunctionComponent = () => {
  const params = React.useMemo(() => new URLSearchParams(window.location.search), []);
  const [roomId, setRoomId] = React.useState(params.get("room") ?? "0001");
  const [name, setName] = React.useState(params.get("name") ?? "");
  const [playerCount, setPlayerCount] = React.useState(Number(params.get("players") ?? "4"));
  const [joined, setJoined] = React.useState(params.has("room") && params.has("name"));
  const submit = (event: React.FormEvent): void => {
    event.preventDefault(); if (!/^000[1-4]$/.test(roomId) || name.trim() === "") return;
    const url = new URL(window.location.href);
    url.searchParams.set("cleanroom", "1");
    url.searchParams.set("game", "guandan");
    url.searchParams.set("cleanroomRoom", roomId);
    url.searchParams.set("room", roomId);
    url.searchParams.set("name", name.trim());
    url.searchParams.set("players", String(playerCount));
    url.searchParams.set("ws", cleanroomWebsocket);
    window.history.replaceState({}, "", url.toString()); setJoined(true);
  };
  if (joined) return <GuandanWebsocketProvider><GuandanStateProvider><GuandanTable /></GuandanStateProvider></GuandanWebsocketProvider>;
  return <main className="cleanroom-join-shell"><form className="cleanroom-join-card" onSubmit={submit}><h1>加入牌室</h1><label>牌室<input value={roomId} onChange={(event) => setRoomId(event.target.value)} /></label><label>开始人数<select value={playerCount} onChange={(event) => setPlayerCount(Number(event.target.value))}>{supportedCounts.map((count) => <option key={count} value={count}>{count} 人</option>)}</select></label><label>您的姓名<input value={name} onChange={(event) => setName(event.target.value)} /></label><button type="submit">进入牌室</button></form></main>;
};
export default CleanroomEntry;
