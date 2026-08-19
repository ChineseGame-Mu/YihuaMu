import * as React from "react";
import { AppStateContext } from "./AppStateProvider";
import websocketHandler from "./websocketHandler";
import { TimerContext } from "./TimerProvider";
import memoize from "./memoize";
import WasmContext from "./WasmContext";
import { GameMessage } from "./gen-types";
import { isWasmAvailable } from "./detectWasm";

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
      if (queue.length > 0) {
        fr.readAsArrayBuffer(queue[0].blob);
      }
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
  const reconnectAttemptRef = React.useRef<number>(0);
  const hasJoinedRoomRef = React.useRef<boolean>(false);
  const intentionallyKickedRef = React.useRef<boolean>(false);
  const mountedRef = React.useRef<boolean>(true);

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
  }, [timer, setTimerRef]);

  React.useEffect(() => {
    mountedRef.current = true;
    const runtimeWebsocketHost = (window as any)._WEBSOCKET_HOST;
    const uri =
      runtimeWebsocketHost !== undefined && runtimeWebsocketHost !== null
        ? runtimeWebsocketHost
        : (location.protocol === "https:" ? "wss://" : "ws://") +
          location.host +
          location.pathname +
          (location.pathname.endsWith("/") ? "api" : "/api");

    const reconnect = (): void => {
      if (!mountedRef.current || intentionallyKickedRef.current) return;
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

    const handleGameMessage = (ws: WebSocket, message: GameMessage): void => {
      if (message && typeof message === "object" && "Kicked" in message) {
        intentionallyKickedRef.current = true;
        ws.close();
        return;
      }
      updateStateRef.current({
        connected: true,
        everConnected: true,
        ...websocketHandler(stateRef.current, message, (msg) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
        }),
      });
    };

    const connect = (): void => {
      if (!mountedRef.current) return;
      const ws = new WebSocket(uri);
      websocketRef.current = ws;

      ws.addEventListener("open", () => {
        reconnectAttemptRef.current = 0;
        updateStateRef.current({ connected: true, everConnected: true });
        const current = stateRef.current;
        if (
          hasJoinedRoomRef.current &&
          current.name.length > 0 &&
          current.roomName.length === 4
        ) {
          ws.send(
            JSON.stringify({
              room_name: current.roomName,
              name: current.name,
              disable_compression: !isWasmAvailable(),
            }),
          );
        }
      });

      ws.addEventListener("close", () => {
        if (websocketRef.current === ws) websocketRef.current = null;
        updateStateRef.current({ connected: false });
        reconnect();
      });

      ws.addEventListener("error", () => {
        if (ws.readyState === WebSocket.OPEN) ws.close();
      });

      ws.addEventListener("message", (event: MessageEvent) => {
        if (timerRef.current !== null)
          clearTimeoutRef.current(timerRef.current);
        setTimerRef.current(null);
        if (typeof event.data === "string") {
          try {
            handleGameMessage(ws, JSON.parse(event.data) as GameMessage);
          } catch (e) {
            console.error("Failed to parse JSON message:", e);
          }
        } else {
          const f = (buf: ArrayBuffer): void => {
            handleGameMessage(
              ws,
              decodeWireFormat(new Uint8Array(buf)) as GameMessage,
            );
          };
          if (event.data.arrayBuffer !== undefined) {
            getBlobArrayBuffer().enqueue(event.data, f);
          } else {
            getFileReader().enqueue(event.data, f);
          }
        }
      });
    };

    connect();
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) clearTimeoutRef.current(timerRef.current);
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      websocketRef.current?.close();
      websocketRef.current = null;
    };
  }, []);

  const send = (value: any): void => {
    const ws = websocketRef.current;
    if (ws === null || ws.readyState !== WebSocket.OPEN) {
      updateStateRef.current({ connected: false });
      return;
    }
    if (
      value !== null &&
      typeof value === "object" &&
      typeof value.room_name === "string" &&
      typeof value.name === "string"
    ) {
      hasJoinedRoomRef.current = true;
      intentionallyKickedRef.current = false;
    }
    if (timerRef.current !== null) clearTimeoutRef.current(timerRef.current);
    const localTimerRef = setTimeoutRef.current(() => {
      if (timerRef.current === localTimerRef) {
        updateStateRef.current({ connected: false });
      }
    }, 5000);
    setTimerRef.current(localTimerRef);
    ws.send(JSON.stringify(value));
  };

  (window as any).send = send;
  return (
    <WebsocketContext.Provider value={{ send }}>
      {props.children}
    </WebsocketContext.Provider>
  );
};

export default WebsocketProvider;
