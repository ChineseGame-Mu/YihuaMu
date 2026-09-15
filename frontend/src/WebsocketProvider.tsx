import * as React from "react";
import { AppStateContext } from "./AppStateProvider";
import websocketHandler from "./websocketHandler";
import { TimerContext } from "./TimerProvider";
import memoize from "./memoize";
import WasmContext from "./WasmContext";
import { GameMessage } from "./gen-types";

import type { JSX } from "react";

interface Context {
  send: (value: any) => void;
}

export const WebsocketContext = React.createContext<Context>({
  send: () => {},
});

interface IProps {
  children: JSX.Element[] | JSX.Element;
}

interface IBlobToArrayBufferQueue {
  enqueue: (blob: Blob, handler: (arr: ArrayBuffer) => void) => void;
}

const getFileReader: () => IBlobToArrayBufferQueue = memoize(() => {
  const queue: Array<{ blob: Blob; handler: (arr: ArrayBuffer) => void }> = [];
  const fr = new FileReader();
  fr.onload = () => {
    const next = queue.shift();
    if (next !== undefined) {
      next.handler(fr.result as ArrayBuffer);
      if (queue.length > 0) fr.readAsArrayBuffer(queue[0].blob);
    }
  };
  return {
    enqueue: (blob: Blob, handler: (arr: ArrayBuffer) => void) => {
      queue.push({ blob, handler });
      if (
        queue.length > 0 &&
        (fr.readyState === FileReader.EMPTY || fr.readyState === FileReader.DONE)
      ) {
        fr.readAsArrayBuffer(queue[0].blob);
      }
    },
  };
});

const getBlobArrayBuffer: () => IBlobToArrayBufferQueue = memoize(() => {
  const queue: Array<{ blob: Blob; handler: (arr: ArrayBuffer) => void }> = [];
  const inflight: number[] = [];
  const onload = (arr: ArrayBuffer): void => {
    const next = queue.shift();
    if (next !== undefined) {
      inflight.shift();
      next.handler(arr);
      if (queue.length > 0) {
        inflight.push(0);
        queue[0].blob.arrayBuffer().then(onload, (err) => console.log(err));
      }
    }
  };
  return {
    enqueue: (blob: Blob, handler: (arr: ArrayBuffer) => void) => {
      queue.push({ blob, handler });
      if (inflight.length === 0 && queue.length > 0) {
        inflight.push(0);
        blob.arrayBuffer().then(onload, (err) => console.log(err));
      }
    },
  };
});

const websocketUri = (): string => {
  const runtimeWebsocketHost = (window as any)._WEBSOCKET_HOST;
  if (runtimeWebsocketHost !== undefined && runtimeWebsocketHost !== null) {
    const base = String(runtimeWebsocketHost).replace(/\/$/, "");
    return base.endsWith("/api") ? base : `${base}/api`;
  }

  // Keep the Vercel frontend and all game modes on the same long-lived Render
  // websocket backend. Guandan uses the sibling /api/guandan endpoint.
  if (location.hostname.endsWith(".vercel.app")) {
    return "wss://chinesegame-yihua.onrender.com/api";
  }

  const protocol = location.protocol === "https:" ? "wss://" : "ws://";
  const basePath = location.pathname.endsWith("/")
    ? location.pathname.slice(0, -1)
    : location.pathname;
  return `${protocol}${location.host}${basePath}/api`;
};

const WebsocketProvider: React.FunctionComponent<
  React.PropsWithChildren<IProps>
> = (props: IProps) => {
  const { state, updateState } = React.useContext(AppStateContext);
  const { decodeWireFormat } = React.useContext(WasmContext);
  const { setTimeout, clearTimeout } = React.useContext(TimerContext);
  const [timer, setTimer] = React.useState<number | null>(null);

  const stateRef = React.useRef(state);
  const updateStateRef = React.useRef(updateState);
  const timerRef = React.useRef(timer);
  const setTimerRef = React.useRef(setTimer);
  const setTimeoutRef = React.useRef(setTimeout);
  const clearTimeoutRef = React.useRef(clearTimeout);
  const websocketRef = React.useRef<WebSocket | null>(null);
  const reconnectTimerRef = React.useRef<number | null>(null);
  const reconnectAttemptRef = React.useRef(0);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    stateRef.current = state;
    updateStateRef.current = updateState;
  }, [state, updateState]);

  React.useEffect(() => {
    setTimeoutRef.current = setTimeout;
    clearTimeoutRef.current = clearTimeout;
  }, [setTimeout, clearTimeout]);

  React.useEffect(() => {
    timerRef.current = timer;
    setTimerRef.current = setTimer;
  }, [timer]);

  React.useEffect(() => {
    mountedRef.current = true;

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
      const ws = new WebSocket(websocketUri());
      websocketRef.current = ws;

      ws.addEventListener("open", () => {
        reconnectAttemptRef.current = 0;
        updateStateRef.current({ connected: true, everConnected: true });
      });

      ws.addEventListener("close", () => {
        if (websocketRef.current === ws) websocketRef.current = null;
        updateStateRef.current({ connected: false });
        scheduleReconnect();
      });

      ws.addEventListener("error", () => {
        if (ws.readyState === WebSocket.OPEN) ws.close();
      });

      ws.addEventListener("message", (event: MessageEvent) => {
        if (timerRef.current !== null)
          clearTimeoutRef.current(timerRef.current);
        setTimerRef.current(null);

        const handleMessage = (message: GameMessage): void => {
          if (message && typeof message === "object" && "Kicked" in message) {
            ws.close();
            return;
          }
          updateStateRef.current({
            connected: true,
            everConnected: true,
            ...websocketHandler(stateRef.current, message, (msg) => {
              if (ws.readyState === WebSocket.OPEN)
                ws.send(JSON.stringify(msg));
            }),
          });
        };

        if (typeof event.data === "string") {
          try {
            handleMessage(JSON.parse(event.data) as GameMessage);
          } catch (e) {
            console.error("Failed to parse JSON message:", e);
          }
          return;
        }

        const decode = (buf: ArrayBuffer): void =>
          handleMessage(decodeWireFormat(new Uint8Array(buf)) as GameMessage);
        if (event.data.arrayBuffer !== undefined) {
          getBlobArrayBuffer().enqueue(event.data, decode);
        } else {
          getFileReader().enqueue(event.data, decode);
        }
      });
    };

    connect();
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null)
        clearTimeoutRef.current(timerRef.current);
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      websocketRef.current?.close();
      websocketRef.current = null;
    };
  }, []);

  const send = (value: any): void => {
    if (timerRef.current !== null) clearTimeoutRef.current(timerRef.current);

    const localTimerRef = setTimeoutRef.current(() => {
      if (timerRef.current === localTimerRef) {
        updateStateRef.current({ connected: false });
        const ws = websocketRef.current;
        if (ws !== null && ws.readyState !== WebSocket.CLOSED) ws.close();
      }
    }, 5000);
    setTimerRef.current(localTimerRef);

    const ws = websocketRef.current;
    if (ws !== null && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(value));
    } else {
      updateStateRef.current({ connected: false });
    }
  };

  (window as any).send = send;

  return (
    <WebsocketContext.Provider value={{ send }}>
      {props.children}
    </WebsocketContext.Provider>
  );
};

export default WebsocketProvider;
