import * as React from "react";
import type { JSX } from "react";
import GuandanWebsocketProvider from "./GuandanWebsocketProvider";
import GuandanStateProvider, {
  GuandanStateContext,
} from "./GuandanStateProvider";
import GuandanTable from "./GuandanTable";
import cleanroomLobbyFinalImage from "./cleanroom-lobby-final-image";
import GuandanNoBeatHint from "./GuandanNoBeatHint";
import GuandanNoBeatControls from "./GuandanNoBeatControls";
import GuandanHeaderDecor from "./GuandanHeaderDecor";
import GuandanCustomSortControls from "./GuandanCustomSortControls";
import ExitGameButton from "./ExitGameButton";
import TimerProvider from "./TimerProvider";
import {
  availabilityByVisibleRoom,
  CLEANROOM_ROOM_IDS,
  cleanroomRoomOptionLabel,
  type CleanroomRoomAvailability,
  type CleanroomRoomId,
  type CleanroomRoomSummary,
} from "./cleanroomRoomAvailability";
import "./cleanroom-join.css";
import "./cleanroom-lobby-artwork.css";

const supportedCounts = [4, 6, 8, 10, 12, 14] as const;
const selectableRooms = CLEANROOM_ROOM_IDS;
type SelectableRoom = CleanroomRoomId;
const cleanroomWebsocket = "wss://chinesegame-yihua.onrender.com/api/guandan";
const cleanroomRoomsApi =
  "https://chinesegame-yihua.onrender.com/api/guandan/rooms";
const defaultCleanroomRoom: SelectableRoom = "0004";

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
  return defaultCleanroomRoom;
};

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
      url.searchParams.set("cleanroomRoom", defaultCleanroomRoom);
    }
    window.location.href = url.toString();
  };

  return (
    <TimerProvider>
      <GuandanWebsocketProvider>
        <GuandanStateProvider>
          <PublicPlayerCountMarker />
          <ExitGameButton onClick={exit} />
          <GuandanHeaderDecor />
          <GuandanCustomSortControls />
          <GuandanTable />
          <GuandanNoBeatHint />
          <GuandanNoBeatControls />
        </GuandanStateProvider>
      </GuandanWebsocketProvider>
    </TimerProvider>
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
  const [roomAvailability, setRoomAvailability] = React.useState<
    Readonly<Partial<Record<SelectableRoom, CleanroomRoomAvailability>>>
  >({});

  React.useEffect(() => {
    if (joined) return;
    let active = true;
    const refreshAvailability = async (): Promise<void> => {
      try {
        const response = await fetch(cleanroomRoomsApi, { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          rooms?: CleanroomRoomSummary[];
        };
        if (active && Array.isArray(payload.rooms)) {
          setRoomAvailability(availabilityByVisibleRoom(payload.rooms));
        }
      } catch {
        // Keep the room list usable if the status endpoint is temporarily unavailable.
      }
    };
    void refreshAvailability();
    const timer = window.setInterval(() => void refreshAvailability(), 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [joined]);

  if (joined) return <CleanroomTable />;

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName === "") return;

    const url = new URL(window.location.href);
    url.searchParams.set("cleanroom", "1");
    url.searchParams.set("game", "guandan");
    url.searchParams.set("cleanroomRoom", roomId);
    url.searchParams.set("room", roomId);
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
    <main className="cleanroom-final-shell">
      <img
        className="cleanroom-final-backdrop"
        src={cleanroomLobbyFinalImage}
        alt=""
        aria-hidden="true"
      />
      <div className="cleanroom-final-stage">
        <img
          className="cleanroom-final-art"
          src={cleanroomLobbyFinalImage}
          alt="掼蛋游戏山水牌室"
        />
        <form
          className="cleanroom-final-form"
          onSubmit={submit}
          aria-label="加入牌室"
        >
          <select
            id="cleanroom-room"
            className="cleanroom-final-control cleanroom-final-room"
            aria-label="牌室（显示在线人数）"
            value={roomId}
            onChange={(event) =>
              setRoomId(event.target.value as SelectableRoom)
            }
          >
            {selectableRooms.map((room) => (
              <option key={room} value={room}>
                {cleanroomRoomOptionLabel(room, roomAvailability[room])}
              </option>
            ))}
          </select>
          <select
            id="cleanroom-player-count"
            className="cleanroom-final-control cleanroom-final-players"
            aria-label="开始人数"
            value={playerCount}
            onChange={(event) => setPlayerCount(Number(event.target.value))}
          >
            {supportedCounts.map((count) => (
              <option key={count} value={count}>
                {count} 人
              </option>
            ))}
          </select>
          <input
            id="cleanroom-player-name"
            className="cleanroom-final-control cleanroom-final-name"
            aria-label="您的姓名"
            value={name}
            maxLength={32}
            placeholder="请输入姓名"
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
          <button
            id="cleanroom-enter-room"
            className="cleanroom-final-enter"
            type="submit"
            disabled={name.trim() === ""}
            aria-label="进入牌室"
          >
            <span>进入牌室</span>
            <small>ENTER ROOM</small>
          </button>
        </form>
      </div>
    </main>
  );
};

export default CleanroomEntry;
