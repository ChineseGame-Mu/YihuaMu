import * as React from "react";

import type { JSX } from "react";
import { adaptGuandanClientMessage } from "./guandanCompatibilityAdapter";
import type {
  GuandanClientMessage,
  GuandanServerMessage,
} from "./guandanProtocol";

declare const __CLEANROOM_BUILD_COMMIT__: string;

type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface GuandanWebsocketContextValue {
  status: ConnectionStatus;
  lastMessage: GuandanServerMessage | null;
  messageSequence: number;
  send: (message: GuandanClientMessage) => boolean;
}

export const GuandanWebsocketContext =
  React.createContext<GuandanWebsocketContextValue>({
    status: "disconnected",
    lastMessage: null,
    messageSequence: 0,
    send: () => false,
  });

interface GuandanWebsocketProviderProps {
  children: JSX.Element[] | JSX.Element;
}

const TEST_WEBSOCKET = "wss://chinesegame-yihua.onrender.com/api/guandan";
const CLEANROOM_WEBSOCKET = "wss://card-games-yihua.onrender.com/api/guandan";
const PLAYER_SESSION_PREFIX = "guandan-player-session:";

export interface StoredPlayerSession {
  readonly playerId: string;
  readonly resumeToken: string;
}

interface JoinWireMessage {
  readonly type: "join";
  readonly room: string;
  readonly name: string;
  readonly [key: string]: unknown;
}

export const addPlayerSessionToJoin = (
  message: JoinWireMessage,
  session: StoredPlayerSession | null,
): JoinWireMessage =>
  session === null
    ? message
    : {
        ...message,
        player_id: session.playerId,
        resume_token: session.resumeToken,
      };

const playerSessionKey = (room: string, name: string): string =>
  `${PLAYER_SESSION_PREFIX}${room}\u0000${name}`;

const readPlayerSession = (
  room: string,
  name: string,
): StoredPlayerSession | null => {
  try {
    const raw = window.sessionStorage.getItem(playerSessionKey(room, name));
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPlayerSession>;
    return typeof parsed.playerId === "string" &&
      parsed.playerId.length > 0 &&
      typeof parsed.resumeToken === "string" &&
      parsed.resumeToken.length > 0
      ? { playerId: parsed.playerId, resumeToken: parsed.resumeToken }
      : null;
  } catch {
    return null;
  }
};

const storePlayerSession = (
  room: string,
  name: string,
  session: StoredPlayerSession,
): void => {
  try {
    window.sessionStorage.setItem(
      playerSessionKey(room, name),
      JSON.stringify(session),
    );
  } catch {
    // The game remains usable when browser storage is unavailable, but a page
    // refresh will require a new player identity.
  }
};

export const cleanroomBuildCommit =
  typeof __CLEANROOM_BUILD_COMMIT__ === "string"
    ? __CLEANROOM_BUILD_COMMIT__
    : "";

export const cleanroomDeploymentRoom = (
  visibleRoom: string | null,
  hostname: string,
): string | null => {
  const room = visibleRoom?.trim();
  if (!room) return null;

  const commitKey = /^[0-9a-f]{7,40}$/i.test(cleanroomBuildCommit)
    ? cleanroomBuildCommit.slice(0, 12).toLowerCase()
    : null;
  if (commitKey !== null) return `cr-${commitKey}-${room}`;

  const normalizedHost = hostname.trim().toLowerCase();
  if (!normalizedHost.endsWith(".vercel.app")) return room;

  const firstLabel = normalizedHost.split(".")[0] ?? "";
  const immutableMatch = firstLabel.match(/-([a-z0-9]{8,16})$/);
  const deploymentKey = immutableMatch?.[1] ?? firstLabel.slice(-16);
  if (!deploymentKey) return room;

  return `cr-${deploymentKey}-${room}`;
};

const cleanroomWebsocketOverride = (): string | null => {
  const query = new URLSearchParams(window.location.search);
  if (query.get("cleanroom") !== "1") return null;
  return CLEANROOM_WEBSOCKET;
};

const testWebsocketOverride = (): string | null => {
  const query = new URLSearchParams(window.location.search);
  if (query.get("test") !== "1") return null;
  const raw = query.get("ws");
  if (raw === null || raw.trim() === "") return TEST_WEBSOCKET;
  try {
    const url = new URL(raw);
    if (url.protocol !== "ws:" && url.protocol !== "wss:") return null;
    return url.toString();
  } catch {
    return null;
  }
};

const websocketUri = (): string => {
  const cleanroom = cleanroomWebsocketOverride();
  if (cleanroom !== null) return cleanroom;

  const override = testWebsocketOverride();
  if (override !== null) return override;

  const runtimeWebsocketHost = (window as any)._WEBSOCKET_HOST;
  if (runtimeWebsocketHost !== undefined && runtimeWebsocketHost !== null) {
    const base = String(runtimeWebsocketHost).replace(/\/$/, "");
    return base.endsWith("/api") ? `${base}/guandan` : `${base}/api/guandan`;
  }

  if (location.hostname.endsWith(".vercel.app")) return TEST_WEBSOCKET;

  const protocol = location.protocol === "https:" ? "wss://" : "ws://";
  const basePath = location.pathname.endsWith("/")
    ? location.pathname.slice(0, -1)
    : location.pathname;
  return `${protocol}${location.host}${basePath}/api/guandan`;
};

const GuandanWebsocketProvider: React.FunctionComponent<
  React.PropsWithChildren<GuandanWebsocketProviderProps>
> = ({ children }) => {
  const [status, setStatus] = React.useState<ConnectionStatus>("connecting");
  const [delivery, setDelivery] = React.useState<{
    message: GuandanServerMessage | null;
    sequence: number;
  }>({ message: null, sequence: 0 });
  const websocketRef = React.useRef<WebSocket | null>(null);
  const reconnectTimerRef = React.useRef<number | null>(null);
  const reconnectAttemptRef = React.useRef(0);
  const mountedRef = React.useRef(true);
  const messageQueueRef = React.useRef<GuandanServerMessage[]>([]);
  const messageQueueIndexRef = React.useRef(0);
  const messageDrainTimerRef = React.useRef<number | null>(null);
  const sequenceRef = React.useRef(0);
  const lastJoinIdentityRef = React.useRef<{
    room: string;
    name: string;
  } | null>(null);

  React.useEffect(() => {
    document.documentElement.dataset.cleanroomCommit = cleanroomBuildCommit;
    mountedRef.current = true;

    const clearQueuedMessages = (): void => {
      if (messageDrainTimerRef.current !== null) {
        window.clearTimeout(messageDrainTimerRef.current);
        messageDrainTimerRef.current = null;
      }
      messageQueueRef.current = [];
      messageQueueIndexRef.current = 0;
    };

    const drainMessages = (): void => {
      messageDrainTimerRef.current = null;
      if (!mountedRef.current) return;
      const next = messageQueueRef.current[messageQueueIndexRef.current];
      if (next === undefined) return;
      messageQueueIndexRef.current += 1;
      sequenceRef.current += 1;
      setDelivery({ message: next, sequence: sequenceRef.current });
      if (messageQueueIndexRef.current < messageQueueRef.current.length) {
        messageDrainTimerRef.current = window.setTimeout(drainMessages, 8);
      } else {
        messageQueueRef.current = [];
        messageQueueIndexRef.current = 0;
      }
    };

    const enqueueMessage = (message: GuandanServerMessage): void => {
      const coalescible = ["waiting", "started", "state", "hand"].includes(
        message.type,
      );
      if (coalescible) {
        const pendingStart = messageQueueIndexRef.current;
        const existing = messageQueueRef.current.findIndex(
          (queued, index) =>
            index >= pendingStart && queued.type === message.type,
        );
        if (existing !== -1) messageQueueRef.current.splice(existing, 1);
      }
      if (messageQueueRef.current.length - messageQueueIndexRef.current >= 32) {
        messageQueueRef.current = messageQueueRef.current.filter(
          (queued, index) =>
            index < messageQueueIndexRef.current ||
            !["waiting", "started", "state", "hand"].includes(queued.type),
        );
      }
      messageQueueRef.current.push(message);
      if (messageDrainTimerRef.current === null) {
        messageDrainTimerRef.current = window.setTimeout(drainMessages, 0);
      }
    };

    const scheduleReconnect = (): void => {
      if (!mountedRef.current) return;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 10000);
      reconnectAttemptRef.current += 1;
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    };

    const connect = (): void => {
      if (!mountedRef.current) return;
      clearQueuedMessages();
      setStatus("connecting");
      const ws = new WebSocket(websocketUri());
      websocketRef.current = ws;

      ws.addEventListener("open", () => {
        if (websocketRef.current !== ws) return;
        reconnectAttemptRef.current = 0;
      });

      ws.addEventListener("message", (event: MessageEvent) => {
        if (websocketRef.current !== ws || typeof event.data !== "string") return;
        try {
          const message = JSON.parse(event.data) as GuandanServerMessage;
          if (message.type === "connected") setStatus("connected");
          if (
            message.type === "joined" &&
            typeof message.player_id === "string" &&
            typeof message.resume_token === "string"
          ) {
            const identity = lastJoinIdentityRef.current;
            if (identity !== null && identity.room === message.room) {
              storePlayerSession(identity.room, identity.name, {
                playerId: message.player_id,
                resumeToken: message.resume_token,
              });
            }
          }
          enqueueMessage(message);
        } catch (error) {
          console.error("Failed to parse Guandan websocket message", error);
        }
      });

      ws.addEventListener("close", () => {
        if (websocketRef.current !== ws) return;
        websocketRef.current = null;
        clearQueuedMessages();
        setStatus("disconnected");
        scheduleReconnect();
      });

      ws.addEventListener("error", () => {
        if (websocketRef.current !== ws) return;
        if (ws.readyState === WebSocket.OPEN) ws.close();
      });
    };

    connect();

    return () => {
      mountedRef.current = false;
      delete document.documentElement.dataset.cleanroomCommit;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      clearQueuedMessages();
      websocketRef.current?.close();
      websocketRef.current = null;
    };
  }, []);

  const send = React.useCallback((message: GuandanClientMessage): boolean => {
    const ws = websocketRef.current;
    if (ws === null || ws.readyState !== WebSocket.OPEN) return false;
    const query = new URLSearchParams(window.location.search);
    const playerCount = Number(query.get("players") ?? "4");
    const desiredSeat = Number(query.get("seat"));
    const cleanroom = query.get("cleanroom") === "1";
    const visibleRoom = query.get("cleanroomRoom");
    const wireRoom = cleanroom
      ? cleanroomDeploymentRoom(visibleRoom, window.location.hostname)
      : visibleRoom;
    const adapted = adaptGuandanClientMessage(message, {
      cleanroom,
      room: wireRoom,
      playerCount: Number.isFinite(playerCount) ? playerCount : 4,
      desiredSeat:
        query.has("seat") && Number.isInteger(desiredSeat) ? desiredSeat : null,
    });
    if (adapted.type === "join") {
      const joinRoom = adapted.room.trim();
      const joinName = adapted.name.trim();
      lastJoinIdentityRef.current = { room: joinRoom, name: joinName };
      const stored = readPlayerSession(joinRoom, joinName);
      ws.send(JSON.stringify(addPlayerSessionToJoin(adapted, stored)));
      return true;
    }
    ws.send(JSON.stringify(adapted));
    return true;
  }, []);

  const value = React.useMemo(
    () => ({
      status,
      lastMessage: delivery.message,
      messageSequence: delivery.sequence,
      send,
    }),
    [status, delivery, send],
  );

  return (
    <GuandanWebsocketContext.Provider value={value}>
      {children}
    </GuandanWebsocketContext.Provider>
  );
};

export default GuandanWebsocketProvider;
