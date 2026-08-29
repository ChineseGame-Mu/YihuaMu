import * as React from "react";

import type { JSX } from "react";
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

const cleanroomWebsocketOverride = (): string | null => {
  const query = new URLSearchParams(window.location.search);
  if (query.get("cleanroom") !== "1") return null;

  const raw = query.get("backend") ?? (window as any)._CLEANROOM_BACKEND;
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;

  try {
    const url = new URL(String(raw));
    if (url.protocol === "https:") url.protocol = "wss:";
    else if (url.protocol === "http:") url.protocol = "ws:";
    else if (url.protocol !== "ws:" && url.protocol !== "wss:") return null;
    url.pathname = "/api/guandan";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
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
  const messageDrainTimerRef = React.useRef<number | null>(null);
  const sequenceRef = React.useRef(0);

  React.useEffect(() => {
    mountedRef.current = true;

    const drainMessages = (): void => {
      messageDrainTimerRef.current = null;
      if (!mountedRef.current) return;

      const next = messageQueueRef.current.shift();
      if (next === undefined) return;

      sequenceRef.current += 1;
      setDelivery({ message: next, sequence: sequenceRef.current });

      if (messageQueueRef.current.length > 0) {
        messageDrainTimerRef.current = window.setTimeout(drainMessages, 8);
      }
    };

    const enqueueMessage = (message: GuandanServerMessage): void => {
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

      setStatus("connecting");
      const ws = new WebSocket(websocketUri());
      websocketRef.current = ws;

      ws.addEventListener("open", () => {
        reconnectAttemptRef.current = 0;
        // Keep the UI in "connecting" until the Guandan server itself confirms
        // protocol readiness. Sending join immediately on the transport-level
        // open event can race the server handshake and leave auto-join stuck.
      });

      ws.addEventListener("message", (event: MessageEvent) => {
        if (typeof event.data !== "string") return;

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
        if (websocketRef.current === ws) websocketRef.current = null;
        setStatus("disconnected");
        scheduleReconnect();
      });

      ws.addEventListener("error", () => {
        if (ws.readyState === WebSocket.OPEN) ws.close();
      });
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (messageDrainTimerRef.current !== null) {
        window.clearTimeout(messageDrainTimerRef.current);
      }
      messageQueueRef.current = [];
      websocketRef.current?.close();
      websocketRef.current = null;
    };
  }, []);

  const send = React.useCallback((message: GuandanClientMessage): boolean => {
    const ws = websocketRef.current;
    if (ws === null || ws.readyState !== WebSocket.OPEN) return false;

    if (message.type === "join") {
      const query = new URLSearchParams(window.location.search);
      if (query.get("cleanroom") === "1") {
        const requested = Number(query.get("players") ?? "4");
        const playerCount = [4, 6, 8, 10, 12, 14].includes(requested)
          ? requested
          : 4;
        ws.send(JSON.stringify({ ...message, player_count: playerCount }));
        return true;
      }
    }

    ws.send(JSON.stringify(message));
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
