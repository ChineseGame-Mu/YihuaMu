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

const websocketUri = (): string => {
  const runtimeWebsocketHost = (window as any)._WEBSOCKET_HOST;
  if (runtimeWebsocketHost !== undefined && runtimeWebsocketHost !== null) {
    const base = String(runtimeWebsocketHost).replace(/\/$/, "");
    return base.endsWith("/api") ? `${base}/guandan` : `${base}/api/guandan`;
  }

  if (location.hostname.endsWith(".vercel.app")) {
    return "wss://chinesegame-yihua.onrender.com/api/guandan";
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
      // Sequence is part of the state update so even two identical protocol
      // messages are distinct React deliveries and cannot collapse together.
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
        setStatus("connected");
      });

      ws.addEventListener("message", (event: MessageEvent) => {
        if (typeof event.data !== "string") return;

        try {
          enqueueMessage(JSON.parse(event.data) as GuandanServerMessage);
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
