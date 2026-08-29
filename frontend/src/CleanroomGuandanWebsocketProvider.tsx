import * as React from "react";
import type { JSX } from "react";
import {
  GuandanWebsocketContext,
} from "./GuandanWebsocketProvider";
import type {
  GuandanCard,
  GuandanClientMessage,
  GuandanRank,
  GuandanServerMessage,
} from "./guandanProtocol";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

type CleanroomCard =
  | { kind: "suited"; suit: "clubs" | "diamonds" | "hearts" | "spades"; rank: "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A" }
  | { kind: "joker"; size: "small" | "big" };

type Participant = {
  id: string;
  name: string;
  seat: number;
  kind: "human" | "robot";
  connected: boolean;
};

type RoomState = {
  type: "room_state";
  roomId: string;
  revision: number;
  playerCount: number;
  participants: Participant[];
};

type GameState = {
  type: "game_state";
  roomId: string;
  revision: number;
  phase: string;
  currentTurn: number;
  handCounts: number[];
  openingDraw: CleanroomCard[];
  openingDrawWinner: number | null;
  leadingPlay: { seat: number; cards: CleanroomCard[] } | null;
  passedSeats: number[];
  finishedSeats: number[];
  completedTricks: number;
};

type PrivateHand = {
  type: "private_hand";
  roomId: string;
  revision: number;
  seat: number;
  cards: Array<{ id: string; card: CleanroomCard }>;
};

type CleanroomMessage =
  | RoomState
  | GameState
  | PrivateHand
  | { type: "error"; message: string; code?: string }
  | { type: "pong" };

const rankMap: Record<Exclude<CleanroomCard, { kind: "joker" }>['rank'], GuandanRank> = {
  "2": "Two",
  "3": "Three",
  "4": "Four",
  "5": "Five",
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
  "10": "Ten",
  J: "Jack",
  Q: "Queen",
  K: "King",
  A: "Ace",
};

const suitMap = {
  clubs: "Clubs",
  diamonds: "Diamonds",
  hearts: "Hearts",
  spades: "Spades",
} as const;

const legacyCard = (card: CleanroomCard): GuandanCard =>
  card.kind === "joker"
    ? { Joker: card.size === "big" ? "Big" : "Small" }
    : { Suited: { suit: suitMap[card.suit], rank: rankMap[card.rank] } };

const sortedParticipants = (room: RoomState): Participant[] =>
  [...room.participants].sort((a, b) => a.seat - b.seat);

const waitingMessage = (room: RoomState): GuandanServerMessage => {
  const players = sortedParticipants(room);
  return {
    type: "waiting",
    players: players.map(({ name }) => name),
    observers: [],
    online_players: players.map(({ connected }) => connected),
    minimum_players: 4,
    maximum_players: 14,
  };
};

const stateMessage = (room: RoomState, game: GameState): GuandanServerMessage => {
  const players = sortedParticipants(room);
  const lastPlay = game.leadingPlay?.cards.map(legacyCard) ?? [];
  return {
    type: "state",
    players: players.map(({ name }) => name),
    observers: [],
    online_players: players.map(({ connected }) => connected),
    turn: game.currentTurn,
    hand_counts: game.handCounts,
    last_play: lastPlay,
    last_player: game.leadingPlay?.seat ?? null,
    table_plays:
      game.leadingPlay === null
        ? []
        : [{ player: game.leadingPlay.seat, cards: lastPlay }],
    passes: game.passedSeats.length,
    trick_complete: false,
    last_trick_winner: null,
    initial_draw: game.openingDraw.map(legacyCard),
    initial_draw_winner: game.openingDrawWinner,
    level: "Two",
    team_levels: null,
    finish_order: game.finishedSeats,
    last_game_winner: null,
    last_game_winner_team: null,
    last_promotion_steps: null,
    pending_tribute: null,
    tribute_resisted: false,
    match_winner: null,
    next_round_phase: game.phase === "round-complete" ? "awaiting_deal" : null,
  };
};

const roomFromLocation = (): string => {
  const query = new URLSearchParams(window.location.search);
  const fromQuery = query.get("room");
  if (fromQuery !== null && fromQuery.trim() !== "") return fromQuery.trim();
  const match = window.location.pathname.match(/^\/room\/([^/]+)/);
  return match === null ? "manual-test" : decodeURIComponent(match[1]!);
};

const websocketUrl = (roomId: string, playerId: string): string => {
  const query = new URLSearchParams(window.location.search);
  const backend = query.get("backend");
  const base = backend === null || backend.trim() === "" ? window.location.origin : backend;
  const url = new URL(base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/ws/rooms/${encodeURIComponent(roomId)}`;
  url.search = `?playerId=${encodeURIComponent(playerId)}`;
  return url.toString();
};

interface Props {
  children: JSX.Element[] | JSX.Element;
  roomId?: string;
  playerId: string;
}

const CleanroomGuandanWebsocketProvider: React.FunctionComponent<
  React.PropsWithChildren<Props>
> = ({ children, roomId = roomFromLocation(), playerId }) => {
  const [status, setStatus] = React.useState<ConnectionStatus>("connecting");
  const [delivery, setDelivery] = React.useState<{ message: GuandanServerMessage | null; sequence: number }>({
    message: null,
    sequence: 0,
  });
  const socketRef = React.useRef<WebSocket | null>(null);
  const roomRef = React.useRef<RoomState | null>(null);
  const cardIdsRef = React.useRef<string[]>([]);
  const queueRef = React.useRef<GuandanServerMessage[]>([]);
  const drainingRef = React.useRef(false);

  const deliver = React.useCallback((message: GuandanServerMessage): void => {
    queueRef.current.push(message);
    if (drainingRef.current) return;
    drainingRef.current = true;
    const drain = (): void => {
      const next = queueRef.current.shift();
      if (next === undefined) {
        drainingRef.current = false;
        return;
      }
      setDelivery((current) => ({ message: next, sequence: current.sequence + 1 }));
      window.setTimeout(drain, 0);
    };
    window.setTimeout(drain, 0);
  }, []);

  React.useEffect(() => {
    setStatus("connecting");
    const socket = new WebSocket(websocketUrl(roomId, playerId));
    socketRef.current = socket;

    socket.addEventListener("open", () => setStatus("connected"));
    socket.addEventListener("message", (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      let raw: CleanroomMessage;
      try {
        raw = JSON.parse(event.data) as CleanroomMessage;
      } catch {
        deliver({ type: "error", message: "clean-room 后台返回了无法识别的数据" });
        return;
      }

      if (raw.type === "room_state") {
        roomRef.current = raw;
        const me = raw.participants.find(({ id }) => id === playerId);
        deliver({ type: "connected", protocol: "yihua-cleanroom-compat-v1" });
        deliver({ type: "joined", room: raw.roomId, seat: me?.seat ?? null });
        deliver(waitingMessage(raw));
        return;
      }
      if (raw.type === "private_hand") {
        cardIdsRef.current = raw.cards.map(({ id }) => id);
        deliver({ type: "hand", cards: raw.cards.map(({ card }) => legacyCard(card)) });
        return;
      }
      if (raw.type === "game_state") {
        const room = roomRef.current;
        if (room === null) return;
        const cardsPerPlayer = Math.max(0, ...raw.handCounts);
        deliver({ type: "started", player_count: raw.handCounts.length, cards_per_player: cardsPerPlayer });
        deliver(stateMessage(room, raw));
        return;
      }
      if (raw.type === "error") deliver({ type: "error", message: raw.message });
    });
    socket.addEventListener("close", () => setStatus("disconnected"));
    socket.addEventListener("error", () => setStatus("disconnected"));

    return () => {
      socket.close();
      socketRef.current = null;
      roomRef.current = null;
      cardIdsRef.current = [];
      queueRef.current = [];
    };
  }, [deliver, playerId, roomId]);

  const send = React.useCallback((message: GuandanClientMessage): boolean => {
    const socket = socketRef.current;
    if (socket === null || socket.readyState !== WebSocket.OPEN) return false;

    let cleanroom: unknown;
    switch (message.type) {
      case "join":
        return true;
      case "set_participation":
        cleanroom = { type: "set_next_round_ready", ready: message.active };
        break;
      case "set_bots":
        cleanroom = { type: "set_robots", count: message.count };
        break;
      case "start":
        cleanroom = { type: "start_game" };
        break;
      case "play": {
        const cardIds = message.card_indexes.map((index) => cardIdsRef.current[index]).filter((id): id is string => id !== undefined);
        if (cardIds.length !== message.card_indexes.length) {
          deliver({ type: "error", message: "待出牌索引与 clean-room 手牌不同步，请刷新后重试。" });
          return false;
        }
        cleanroom = { type: "play_cards", cardIds };
        break;
      }
      case "pass":
        cleanroom = { type: "pass_turn" };
        break;
      case "end_round":
      case "deal_next_round":
        cleanroom = { type: "next_round" };
        break;
      case "shuffle_next_round":
        return true;
      case "reorder_players":
      case "tribute_card":
      case "return_tribute":
        deliver({ type: "error", message: "此操作尚未由 clean-room compatibility adapter 开放。" });
        return false;
    }

    socket.send(JSON.stringify(cleanroom));
    return true;
  }, [deliver]);

  const value = React.useMemo(
    () => ({ status, lastMessage: delivery.message, messageSequence: delivery.sequence, send }),
    [delivery, send, status],
  );

  return (
    <GuandanWebsocketContext.Provider value={value}>
      {children}
    </GuandanWebsocketContext.Provider>
  );
};

export default CleanroomGuandanWebsocketProvider;
