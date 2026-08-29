import * as React from "react";
import type { JSX } from "react";
import CleanroomGuandanWebsocketProvider from "./CleanroomGuandanWebsocketProvider";
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

const backendOrigin = (): string => {
  const query = new URLSearchParams(window.location.search);
  const backend = query.get("backend");
  return backend === null || backend.trim() === "" ? window.location.origin : backend.replace(/\/$/, "");
};

const randomId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const websocketUrl = (backend: string, roomId: string, playerId: string): string => {
  const url = new URL(backend);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/ws/rooms/${encodeURIComponent(roomId)}`;
  url.search = `?playerId=${encodeURIComponent(playerId)}`;
  return url.toString();
};

const ensureRoom = async (backend: string, roomId: string, playerCount: number): Promise<void> => {
  const existing = await fetch(`${backend}/api/rooms/${encodeURIComponent(roomId)}`);
  if (existing.ok) return;
  if (existing.status !== 404) throw new Error("无法读取牌室状态");

  const created = await fetch(`${backend}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomId, playerCount }),
  });
  if (!created.ok && created.status !== 409) throw new Error("无法建立牌室");
};

const allocateSeat = async (
  backend: string,
  roomId: string,
  playerId: string,
  name: string,
): Promise<void> =>
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(websocketUrl(backend, roomId, playerId));
    let joinSent = false;
    const timer = window.setTimeout(() => {
      socket.close();
      reject(new Error("进入牌室超时，请重试。"));
    }, 10000);

    const finish = (error?: Error): void => {
      window.clearTimeout(timer);
      socket.close();
      if (error === undefined) resolve();
      else reject(error);
    };

    socket.addEventListener("message", (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      const message = JSON.parse(event.data) as any;
      if (message.type === "error") {
        finish(new Error(String(message.message ?? "无法进入牌室")));
        return;
      }
      if (message.type !== "room_state") return;

      const existing = message.participants?.find((participant: any) => participant.id === playerId);
      if (existing !== undefined) {
        finish();
        return;
      }
      if (joinSent) return;

      const occupied = new Set<number>(
        (message.participants ?? []).map((participant: any) => Number(participant.seat)),
      );
      let seat = -1;
      for (let candidate = 0; candidate < Number(message.playerCount); candidate += 1) {
        if (!occupied.has(candidate)) {
          seat = candidate;
          break;
        }
      }
      if (seat < 0 && Number(message.playerCount) < 14) seat = Number(message.playerCount);
      if (seat < 0) {
        finish(new Error("本牌室已经达到 14 人上限。"));
        return;
      }
      joinSent = true;
      socket.send(JSON.stringify({ type: "join_room", roomId, playerId, name, seat }));
    });
    socket.addEventListener("error", () => finish(new Error("连接 clean-room 后台失败。")));
  });

const CleanroomJoinPage = ({ onJoined }: { onJoined: (playerId: string, name: string) => void }): JSX.Element => {
  const roomId = React.useMemo(roomFromLocation, []);
  const backend = React.useMemo(backendOrigin, []);
  const params = React.useMemo(() => new URLSearchParams(window.location.search), []);
  const requested = Number(params.get("playerCount") ?? "4");
  const [playerCount, setPlayerCount] = React.useState<number>(supportedCounts.includes(requested as any) ? requested : 4);
  const [name, setName] = React.useState(params.get("playerName") ?? "");
  const [status, setStatus] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName === "") return;
    setBusy(true);
    setStatus("正在进入牌室…");
    try {
      await ensureRoom(backend, roomId, playerCount);
      const playerId = randomId();
      await allocateSeat(backend, roomId, playerId, cleanName);
      window.localStorage.setItem(`yihua-room-player:${roomId}`, playerId);
      window.localStorage.setItem(`yihua-room-name:${roomId}`, cleanName);
      onJoined(playerId, cleanName);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "无法进入牌室，请重试。");
      setBusy(false);
    }
  };

  return (
    <main className="cleanroom-join-shell">
      <section className="cleanroom-join-card">
        <h1>加入牌室</h1>
        <p className="cleanroom-room-label">房间： <strong>{roomId}</strong></p>
        <form onSubmit={(event) => void submit(event)}>
          <label>开始人数：4–14 人</label>
          <select value={playerCount} disabled={busy} onChange={(event) => setPlayerCount(Number(event.target.value))}>
            {supportedCounts.map((count) => <option key={count} value={count}>{count} 人</option>)}
          </select>
          <p className="cleanroom-note">第一位进入的玩家确定开始人数；之后可继续增加到 14 人。</p>
          <label>您的姓名</label>
          <input value={name} maxLength={16} placeholder="请输入姓名" autoFocus onChange={(event) => setName(event.target.value)} />
          <button type="submit" disabled={busy || name.trim() === ""}>进入牌室</button>
        </form>
        <p className="cleanroom-hint">全部使用真人。游戏开始后 3 小时内可继续加入；人数按 6→8→10→12→14 逐步增加，当前一局不中断，新玩家从满足偶数人数后的下一局开始参赛。</p>
        <p className="cleanroom-status" role="status">{status}</p>
      </section>
    </main>
  );
};

const CleanroomTable = ({ playerId, roomId }: { playerId: string; roomId: string }): JSX.Element => {
  const exit = (): void => {
    const url = new URL(window.location.href);
    url.searchParams.delete("playerId");
    url.searchParams.delete("name");
    window.location.href = url.toString();
  };

  return (
    <CleanroomGuandanWebsocketProvider playerId={playerId} roomId={roomId}>
      <GuandanStateProvider>
        <ExitGameButton onClick={exit} />
        <GuandanHeaderDecor />
        <GuandanCustomSortControls />
        <GuandanTable />
        <GuandanNoBeatHint />
        <GuandanNoBeatControls />
      </GuandanStateProvider>
    </CleanroomGuandanWebsocketProvider>
  );
};

const CleanroomEntry = (): JSX.Element => {
  const roomId = React.useMemo(roomFromLocation, []);
  const params = React.useMemo(() => new URLSearchParams(window.location.search), []);
  const storedPlayerId = window.localStorage.getItem(`yihua-room-player:${roomId}`);
  const [playerId, setPlayerId] = React.useState<string | null>(params.get("playerId") ?? storedPlayerId);

  if (playerId !== null) return <CleanroomTable playerId={playerId} roomId={roomId} />;

  return (
    <CleanroomJoinPage
      onJoined={(nextPlayerId, name) => {
        const url = new URL(window.location.href);
        url.searchParams.set("cleanroom", "1");
        url.searchParams.set("game", "guandan");
        url.searchParams.set("room", roomId);
        url.searchParams.set("name", name);
        url.searchParams.set("playerId", nextPlayerId);
        window.history.replaceState({}, "", url.toString());
        setPlayerId(nextPlayerId);
      }}
    />
  );
};

export default CleanroomEntry;
