import * as React from "react";
import type { JSX } from "react";
import GuandanWebsocketProvider from "./GuandanWebsocketProvider";
import GuandanStateProvider from "./GuandanStateProvider";
import GuandanTable from "./GuandanTable";
import GuandanNoBeatHint from "./GuandanNoBeatHint";
import GuandanNoBeatControls from "./GuandanNoBeatControls";
import GuandanHeaderDecor from "./GuandanHeaderDecor";
import GuandanCustomSortControls from "./GuandanCustomSortControls";
import ExitGameButton from "./ExitGameButton";

const supportedCounts = [4, 6, 8, 10, 12, 14] as const;

const roomFromLocation = (): string => {
  const query = new URLSearchParams(window.location.search);
  const fromQuery = query.get("room");
  if (fromQuery !== null && fromQuery.trim() !== "") return fromQuery.trim();
  const match = window.location.pathname.match(/^\/room\/([^/]+)/);
  return match === null ? "manual-test" : decodeURIComponent(match[1]!);
};

const CleanroomTable = (): JSX.Element => {
  const exit = (): void => {
    const url = new URL(window.location.href);
    url.searchParams.delete("game");
    url.searchParams.delete("name");
    url.searchParams.delete("players");
    window.location.href = url.toString();
  };

  return (
    <GuandanWebsocketProvider>
      <GuandanStateProvider>
        <ExitGameButton onClick={exit} />
        <GuandanHeaderDecor />
        <GuandanCustomSortControls />
        <GuandanTable />
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
  const roomId = React.useMemo(roomFromLocation, []);
  const requested = Number(initial.get("playerCount") ?? initial.get("players") ?? "4");
  const initialCount = supportedCounts.includes(
    requested as (typeof supportedCounts)[number],
  )
    ? requested
    : 4;
  const [playerCount, setPlayerCount] = React.useState<number>(initialCount);
  const [name, setName] = React.useState(
    initial.get("playerName") ?? initial.get("name") ?? "",
  );
  const [joined, setJoined] = React.useState(
    initial.get("game") === "guandan" && (initial.get("name") ?? "").trim() !== "",
  );

  if (joined) return <CleanroomTable />;

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName === "") return;

    const url = new URL(window.location.href);
    url.searchParams.set("cleanroom", "1");
    url.searchParams.set("game", "guandan");
    url.searchParams.set("room", roomId);
    url.searchParams.set("name", cleanName);
    url.searchParams.set("players", String(playerCount));
    url.searchParams.delete("playerName");
    url.searchParams.delete("playerCount");
    window.history.replaceState({}, "", url.toString());
    setJoined(true);
  };

  return (
    <main className="cleanroom-join-shell">
      <section className="cleanroom-join-card">
        <h1>加入牌室</h1>
        <p className="cleanroom-room-label">
          房间： <strong>{roomId}</strong>
        </p>
        <form onSubmit={submit}>
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
            maxLength={16}
            placeholder="请输入姓名"
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" disabled={name.trim() === ""}>
            进入牌室
          </button>
        </form>
        <p className="cleanroom-hint">
          全部使用真人。游戏开始后 3 小时内可继续加入；人数按
          6→8→10→12→14 逐步增加，当前一局不中断，新玩家从满足偶数人数后的下一局开始参赛。
        </p>
      </section>
    </main>
  );
};

export default CleanroomEntry;
