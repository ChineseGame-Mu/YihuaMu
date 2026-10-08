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
  leave: () => boolean;
  getRecoveryCode: () => string | null;
}

export const GuandanWebsocketContext =
  React.createContext<GuandanWebsocketContextValue>({
    status: "disconnected",
    lastMessage: null,
    messageSequence: 0,
    send: () => false,
    leave: () => false,
    getRecoveryCode: () => null,
  });

interface GuandanWebsocketProviderProps {
  children: JSX.Element[] | JSX.Element;
}

export const shouldCoalesceGuandanServerMessage = (
  message: { readonly type: GuandanServerMessage["type"] },
): boolean => ["waiting", "started", "hand"].includes(message.type);

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

export const sendGuandanLeave = (
  socket: Pick<WebSocket, "readyState" | "send"> | null,
  hasJoinedRoom: boolean,
): boolean => {
  if (
    !hasJoinedRoom ||
    socket === null ||
    socket.readyState !== WebSocket.OPEN
  ) {
    return false;
  }
  socket.send(JSON.stringify({ type: "leave" }));
  return true;
};

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

export const withGuandanJoinCredentials = (
  message: JoinWireMessage,
  session: StoredPlayerSession | null,
): JoinWireMessage =>
  typeof message.resume_token === "string" &&
  message.resume_token.trim() !== ""
    ? message
    : addPlayerSessionToJoin(message, session);

const playerSessionKey = (room: string, name: string): string =>
  `${PLAYER_SESSION_PREFIX}${room}\u0000${name}`;

// Only a valid token for a room that no longer exists may be retried without
// credentials. Retrying missing/expired credentials cannot reclaim a reserved
// seat and instead traps the player in a second authentication error.
export const isRecoverablePlayerSessionError = (message: string): boolean =>
  message === "player session no longer belongs to this room";

const parseStoredPlayerSession = (raw: string | null): StoredPlayerSession | null => {
  if (raw === null) return null;
  try {
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

export const readPlayerSession = (
  room: string,
  name: string,
): StoredPlayerSession | null => {
  const key = playerSessionKey(room, name);
  // sessionStorage is isolated to one browser tab. localStorage keeps the
  // signed credential when iOS closes/reopens that tab or creates a new tab
  // in the same browser. Neither storage is shared across different browsers.
  for (const storageType of ["sessionStorage", "localStorage"] as const) {
    try {
      const session = parseStoredPlayerSession(
        window[storageType].getItem(key),
      );
      if (session !== null) return session;
    } catch {
      // Storage can be blocked by private browsing or privacy settings.
    }
  }
  return null;
};

export const storePlayerSession = (
  room: string,
  name: string,
  session: StoredPlayerSession,
): void => {
  const key = playerSessionKey(room, name);
  for (const storageType of ["sessionStorage", "localStorage"] as const) {
    try {
      window[storageType].setItem(key, JSON.stringify(session));
    } catch {
      // A blocked storage mechanism must not prevent a successful join.
    }
  }
};

const clearPlayerSession = (room: string, name: string): void => {
  const key = playerSessionKey(room, name);
  for (const storageType of ["sessionStorage", "localStorage"] as const) {
    try {
      window[storageType].removeItem(key);
    } catch {
      // Another storage mechanism may still be available.
    }
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

  const normalizedHost = hostname.trim().toLowerCase();
  if (normalizedHost === "yihua-mu.vercel.app") return room;
  if (!normalizedHost.endsWith(".vercel.app")) return room;

  const commitKey = /^[0-9a-f]{7,40}$/i.test(cleanroomBuildCommit)
    ? cleanroomBuildCommit.slice(0, 12).toLowerCase()
    : null;
  if (commitKey !== null) return `cr-${commitKey}-${room}`;

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
  const lastJoinMessageRef = React.useRef<JoinWireMessage | null>(null);
  const sessionRecoveryAttemptedRef = React.useRef(false);

  const leave = React.useCallback((): boolean => {
    const ws = websocketRef.current;
    if (!sendGuandanLeave(ws, lastJoinIdentityRef.current !== null)) return false;
    lastJoinIdentityRef.current = null;
    return true;
  }, []);

  const getRecoveryCode = React.useCallback((): string | null => {
    const identity = lastJoinIdentityRef.current;
    return identity === null
      ? null
      : readPlayerSession(identity.room, identity.name)?.resumeToken ?? null;
  }, []);

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
      // State snapshots carry transition edges such as table_clear_id and
      // trick_complete. Dropping an intermediate state can leave the previous
      // trick visible and hide the first play of the next trick.
      const coalescible = shouldCoalesceGuandanServerMessage(message);
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
            !shouldCoalesceGuandanServerMessage(queued),
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
            sessionRecoveryAttemptedRef.current = false;
            const identity = lastJoinIdentityRef.current;
            if (identity !== null && identity.room === message.room) {
              storePlayerSession(identity.room, identity.name, {
                playerId: message.player_id,
                resumeToken: message.resume_token,
              });
            }
          }
          if (
            message.type === "error" &&
            isRecoverablePlayerSessionError(message.message) &&
            !sessionRecoveryAttemptedRef.current
          ) {
            const identity = lastJoinIdentityRef.current;
            const lastJoin = lastJoinMessageRef.current;
            if (identity !== null && lastJoin !== null) {
              sessionRecoveryAttemptedRef.current = true;
              clearPlayerSession(identity.room, identity.name);
              // The old room is gone: retry as a new participant without
              // replaying an obsolete pasted or stored session credential.
              const freshJoin = Object.fromEntries(
                Object.entries(lastJoin).filter(
                  ([key]) => key !== "resume_token" && key !== "player_id",
                ),
              ) as JoinWireMessage;
              ws.send(JSON.stringify(freshJoin));
              return;
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
      // Closing, refreshing, suspending, or losing the page is not an explicit\n      // table departure. The server keeps the human seat reserved so the same\n      // room/name can recover its original hand and game state. Only the\n      // dedicated Exit control sends the explicit `leave` command.\n      delete document.documentElement.dataset.cleanroomCommit;
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
      lastJoinMessageRef.current = adapted;
      sessionRecoveryAttemptedRef.current = false;
      const stored = readPlayerSession(joinRoom, joinName);
      // A manually pasted recovery code takes precedence over credentials
      // saved by another session with the same visible name.
      ws.send(JSON.stringify(withGuandanJoinCredentials(adapted, stored)));
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
      leave,
      getRecoveryCode,
    }),
    [status, delivery, send, leave, getRecoveryCode],
  );

  return (
    <GuandanWebsocketContext.Provider value={value}>
      {children}
    </GuandanWebsocketContext.Provider>
  );
};

export default GuandanWebsocketProvider;
