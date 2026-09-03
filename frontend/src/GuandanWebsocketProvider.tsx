import * as React from "react";

import type { JSX } from "react";
import { adaptGuandanClientMessage } from "./guandanCompatibilityAdapter";
import type {
  GuandanClientMessage,
  GuandanServerMessage,
} from "./guandanProtocol";

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
const COALESCIBLE_MESSAGE_TYPES = new Set<GuandanServerMessage["type"]>([
  "waiting",
  "started",
  "state",
  "hand",
]);
const MAX_PENDING_MESSAGES = 32;

const cleanroomWebsocketOverride = (): string | null => {
  const query = new URLSearchParams(window.location.search);
  if (query.get("cleanroom") !== "1") return null;

  // The clean-room entry is deliberately isolated from the legacy production
  // backend. Ignore stale or user-supplied backend/ws overrides while the
  // clean-room flag is active so the accepted GuandanTable can only reach the
  // new clean-room card-games-yihua service through the compatibility adapter.
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

  if (location.hostname.endsWith(".vercel.app")) {
    return TEST_WEBSOCKET;
  }

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

  React.useEffect(() => {
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

      const queue = messageQueueRef.current;
      const queueIndex = messageQueueIndexRef.current;
      const next = queue[queueIndex];
      if (next === undefined) return;

      messageQueueIndexRef.current = queueIndex + 1;
      sequenceRef.current += 1;
      setDelivery({ message: next, sequence: sequenceRef.current });

      if (messageQueueIndexRef.current < queue.length) {
        messageDrainTimerRef.current = window.setTimeout(drainMessages, 8);
        return;
      }

      messageQueueRef.current = [];
      messageQueueIndexRef.current = 0;
    };

    const enqueueMessage = (message: GuandanServerMessage): void => {
      const queue = messageQueueRef.current;
      const queueIndex = messageQueueIndexRef.current;

      // State-like messages supersede older pending messages of the same type.
      // This keeps the UI current instead of replaying stale snapshots when a
      // busy table produces updates faster than a browser can render them.
      if (COALESCIBLE_MESSAGE_TYPES.has(message.type)) {
        let replacement = -1;
        for (let index = queue.length - 1; index >= queueIndex; index -= 1) {
          if (queue[index].type === message.type) {
            replacement = index;
            break;
          }
        }
        if (replacement >= 0) {
          queue[replacement] = message;
        } else {
          queue.push(message);
        }
      } else {
        queue.push(message);
      }

      while (queue.length - queueIndex > MAX_PENDING_MESSAGES) {
        const staleIndex = queue.findIndex(
          (queued, index) =>
            index >= queueIndex && COALESCIBLE_MESSAGE_TYPES.has(queued.type),
        );
        if (staleIndex < 0) break;
        queue.splice(staleIndex, 1);
      }
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
        // Keep the UI in "connecting" until the Guandan server itself confirms
        // protocol readiness. Sending join immediately on the transport-level
        // open event can race the server handshake and leave auto-join stuck.
      });

      ws.addEventListener("message", (event: MessageEvent) => {
        if (websocketRef.current !== ws || typeof event.data !== "string") return;

        try {
          const message = JSON.parse(event.data) as GuandanServerMessage;
          if (message.type === "connected") {
            setStatus("connected");
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
    const adapted = adaptGuandanClientMessage(message, {
      cleanroom: query.get("cleanroom") === "1",
      room: query.get("cleanroomRoom"),
      playerCount: Number.isFinite(playerCount) ? playerCount : 4,
    });

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
