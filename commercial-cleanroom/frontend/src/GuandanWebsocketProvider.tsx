import * as React from "react";
import type { JSX } from "react";
import { adaptGuandanClientMessage } from "./guandanCompatibilityAdapter";
import type { GuandanClientMessage, GuandanServerMessage } from "./guandanProtocol";

declare const __CLEANROOM_BUILD_COMMIT__: string;
type ConnectionStatus = "connecting" | "connected" | "disconnected";
interface ContextValue { status: ConnectionStatus; lastMessage: GuandanServerMessage | null; messageSequence: number; send: (message: GuandanClientMessage) => boolean; }
export const GuandanWebsocketContext = React.createContext<ContextValue>({ status: "disconnected", lastMessage: null, messageSequence: 0, send: () => false });
interface Props { children: JSX.Element[] | JSX.Element; }
const CLEANROOM_WEBSOCKET = "wss://chinesegame-yihua.onrender.com/api/guandan";
export const cleanroomBuildCommit = typeof __CLEANROOM_BUILD_COMMIT__ === "string" ? __CLEANROOM_BUILD_COMMIT__ : "";
export const cleanroomDeploymentRoom = (visibleRoom: string | null): string | null => { const room = visibleRoom?.trim(); if (!room) return null; const key = /^[0-9a-f]{7,40}$/i.test(cleanroomBuildCommit) ? cleanroomBuildCommit.slice(0, 12).toLowerCase() : null; return key === null ? room : `cr-${key}-${room}`; };
const websocketUri = (): string => { const query = new URLSearchParams(window.location.search); if (query.get("cleanroom") !== "1") return CLEANROOM_WEBSOCKET; return CLEANROOM_WEBSOCKET; };
const GuandanWebsocketProvider: React.FunctionComponent<React.PropsWithChildren<Props>> = ({ children }) => {
  const [status, setStatus] = React.useState<ConnectionStatus>("connecting");
  const [delivery, setDelivery] = React.useState<{ message: GuandanServerMessage | null; sequence: number }>({ message: null, sequence: 0 });
  const websocketRef = React.useRef<WebSocket | null>(null); const reconnectTimerRef = React.useRef<number | null>(null); const reconnectAttemptRef = React.useRef(0); const mountedRef = React.useRef(true); const generationRef = React.useRef(0); const messageQueueRef = React.useRef<GuandanServerMessage[]>([]); const messageQueueIndexRef = React.useRef(0); const messageDrainTimerRef = React.useRef<number | null>(null); const sequenceRef = React.useRef(0);
  React.useEffect(() => {
    mountedRef.current = true;
    const clearQueuedMessages = (): void => { if (messageDrainTimerRef.current !== null) window.clearTimeout(messageDrainTimerRef.current); messageDrainTimerRef.current = null; messageQueueRef.current = []; messageQueueIndexRef.current = 0; };
    const drainMessages = (): void => { messageDrainTimerRef.current = null; const next = messageQueueRef.current[messageQueueIndexRef.current]; if (!mountedRef.current || next === undefined) return; messageQueueIndexRef.current += 1; sequenceRef.current += 1; setDelivery({ message: next, sequence: sequenceRef.current }); if (messageQueueIndexRef.current < messageQueueRef.current.length) messageDrainTimerRef.current = window.setTimeout(drainMessages, 8); else clearQueuedMessages(); };
    const enqueueMessage = (message: GuandanServerMessage): void => { messageQueueRef.current.push(message); if (messageDrainTimerRef.current === null) messageDrainTimerRef.current = window.setTimeout(drainMessages, 0); };
    const scheduleReconnect = (): void => { if (!mountedRef.current) return; const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 10000); reconnectAttemptRef.current += 1; reconnectTimerRef.current = window.setTimeout(connect, delay); };
    const connect = (): void => { if (!mountedRef.current) return; clearQueuedMessages(); setStatus("connecting"); const generation = ++generationRef.current; const ws = new WebSocket(websocketUri()); websocketRef.current = ws;
      ws.addEventListener("open", () => { if (websocketRef.current !== ws) return; if (generationRef.current !== generation) return; reconnectAttemptRef.current = 0; });
      ws.addEventListener("message", (event: MessageEvent) => { if (websocketRef.current !== ws) return; if (generationRef.current !== generation) return; if (typeof event.data !== "string") return; try { const message = JSON.parse(event.data) as GuandanServerMessage; if (message.type === "connected") setStatus("connected"); enqueueMessage(message); } catch { /* malformed server frames are ignored */ } });
      ws.addEventListener("close", () => { if (websocketRef.current !== ws) return; websocketRef.current = null; clearQueuedMessages(); setStatus("disconnected"); scheduleReconnect(); });
      ws.addEventListener("error", () => { if (websocketRef.current !== ws) return; if (ws.readyState === WebSocket.OPEN) ws.close(); });
    };
    connect(); return () => { mountedRef.current = false; generationRef.current += 1; if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current); clearQueuedMessages(); websocketRef.current?.close(); websocketRef.current = null; };
  }, []);
  const send = React.useCallback((message: GuandanClientMessage): boolean => { const ws = websocketRef.current; if (ws === null || ws.readyState !== WebSocket.OPEN) return false; const query = new URLSearchParams(window.location.search); const playerCount = Number(query.get("players") ?? "4"); const desiredSeat = Number(query.get("seat")); const adapted = adaptGuandanClientMessage(message, { cleanroom: true, room: query.get("cleanroomRoom"), playerCount: Number.isFinite(playerCount) ? playerCount : 4, desiredSeat: query.has("seat") && Number.isInteger(desiredSeat) ? desiredSeat : null }); ws.send(JSON.stringify(adapted)); return true; }, []);
  const value = React.useMemo(() => ({ status, lastMessage: delivery.message, messageSequence: delivery.sequence, send }), [status, delivery, send]);
  return <GuandanWebsocketContext.Provider value={value}>{children}</GuandanWebsocketContext.Provider>;
};
export default GuandanWebsocketProvider;
