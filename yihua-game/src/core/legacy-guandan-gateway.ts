import {
  gameStateToLegacy,
  privateHandToLegacy,
  roomStateToLegacyWaiting,
  toCleanroomCommand,
  type FrontendCompatState,
  type LegacyClientMessage,
  type LegacyServerMessage,
} from "./frontend-compat.js";
import type { ServerMessage } from "./protocol.js";
import { disconnectHuman, reconnectHuman } from "./room.js";
import type { ServerRuntime } from "./server-runtime.js";
import type { SupportedPlayerCount } from "./table.js";
import type { TextSocket } from "./websocket-service.js";
import type { UpgradedConnection } from "./websocket-upgrade.js";

const sendLegacy = async (
  socket: TextSocket,
  message: LegacyServerMessage,
): Promise<void> => {
  await socket.send(JSON.stringify(message));
};

const parseLegacyClientMessage = (raw: string): LegacyClientMessage => {
  const parsed = JSON.parse(raw) as Partial<LegacyClientMessage>;
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    typeof parsed.type !== "string"
  ) {
    throw new Error("legacy message must be an object with a type");
  }
  return parsed as LegacyClientMessage;
};

const legacyPlayerId = (name: string): string => {
  const normalized = name.trim();
  if (normalized.length === 0) throw new Error("player name is required");
  return `legacy:${normalized}`;
};

class LegacyAdapterSocket implements TextSocket {
  private roomState:
    | Extract<ServerMessage, { readonly type: "room_state" }>
    | undefined;
  private startedRevision: number | undefined;
  readonly compat: {
    roomId: string;
    playerId: string;
    seat: number | null;
    privateCardIds: string[];
  };

  constructor(
    private readonly socket: TextSocket,
    initial: FrontendCompatState,
  ) {
    this.compat = {
      roomId: initial.roomId,
      playerId: initial.playerId,
      seat: initial.seat,
      privateCardIds: [...initial.privateCardIds],
    };
  }

  async send(text: string): Promise<void> {
    const message = JSON.parse(text) as ServerMessage;
    switch (message.type) {
      case "room_state":
        this.roomState = message;
        await sendLegacy(this.socket, roomStateToLegacyWaiting(message));
        return;
      case "private_hand":
        this.compat.privateCardIds.splice(
          0,
          this.compat.privateCardIds.length,
          ...message.cards.map(({ id }) => id),
        );
        await sendLegacy(this.socket, privateHandToLegacy(message));
        return;
      case "game_state":
        if (this.roomState === undefined) return;
        if (this.startedRevision === undefined) {
          this.startedRevision = message.revision;
          await sendLegacy(this.socket, {
            type: "started",
            player_count: message.handCounts.length,
            cards_per_player: message.handCounts[0] ?? 0,
          });
        }
        await sendLegacy(
          this.socket,
          gameStateToLegacy(this.roomState, message),
        );
        return;
      case "error":
        await sendLegacy(this.socket, {
          type: "error",
          message: message.message,
        });
        return;
      case "pong":
        return;
    }
  }

  close(code?: number, reason?: string): void | Promise<void> {
    if (this.socket.close === undefined) return;
    return this.socket.close(code, reason);
  }
}

const supportedPlayerCount = (value: unknown): SupportedPlayerCount => {
  const count = Number(value);
  return count === 4 ||
    count === 6 ||
    count === 8 ||
    count === 10 ||
    count === 12 ||
    count === 14
    ? count
    : 4;
};

const ensureLegacyRoom = (
  runtime: ServerRuntime,
  roomId: string,
  requestedPlayerCount: unknown,
): void => {
  try {
    runtime.rooms.get(roomId);
  } catch {
    runtime.rooms.create(roomId, supportedPlayerCount(requestedPlayerCount));
  }
};

export const attachLegacyGuandanConnection = async (
  runtime: ServerRuntime,
  connection: UpgradedConnection,
): Promise<void> => {
  await sendLegacy(connection.socket, {
    type: "connected",
    protocol: "yihua-cleanroom-guandan-v1",
  });

  let active:
    | {
        roomId: string;
        playerId: string;
        adapter: LegacyAdapterSocket;
      }
    | undefined;

  connection.onClose(async () => {
    if (active === undefined) return;
    runtime.sockets.unregister(active.roomId, active.adapter);
    if (
      runtime.sockets.playerConnectionCount(active.roomId, active.playerId) > 0
    ) {
      return;
    }
    try {
      const managed = runtime.rooms.get(active.roomId);
      const next = runtime.rooms.set(active.roomId, {
        ...managed,
        room: disconnectHuman(managed.room, active.playerId),
      });
      await runtime.websocket.broadcastRoomState(next);
    } catch {
      // Room may have been removed while the socket was closing.
    }
  });

  connection.onText(async (raw) => {
    try {
      const message = parseLegacyClientMessage(raw);
      if (message.type === "join") {
        if (active !== undefined) {
          throw new Error("connection already joined a room");
        }
        const roomId = message.room.trim();
        if (roomId.length === 0) throw new Error("room id is required");
        const playerId = legacyPlayerId(message.name);
        const requestedPlayerCount = (
          message as LegacyClientMessage & { readonly player_count?: number }
        ).player_count;
        ensureLegacyRoom(runtime, roomId, requestedPlayerCount);

        let managed = runtime.rooms.get(roomId);
        const existing = managed.room.participants.find(
          ({ id, kind }) => id === playerId && kind === "human",
        );
        const seat = existing?.seat ?? managed.room.participants.length;
        const adapter = new LegacyAdapterSocket(connection.socket, {
          roomId,
          playerId,
          seat,
          privateCardIds: [],
        });

        try {
          runtime.sockets.register(roomId, adapter, playerId);
          if (existing !== undefined) {
            if (!existing.connected) {
              managed = runtime.rooms.set(roomId, {
                ...managed,
                room: reconnectHuman(managed.room, playerId),
              });
              await runtime.websocket.broadcastRoomState(managed);
            }
          } else {
            await runtime.websocket.handleText(
              adapter,
              { roomId, playerId },
              JSON.stringify({
                type: "join_room",
                roomId,
                playerId,
                name: message.name,
                seat,
              }),
            );
            const joined = runtime.rooms
              .get(roomId)
              .room.participants.some(
                ({ id, kind }) => id === playerId && kind === "human",
              );
            if (!joined) {
              runtime.sockets.unregister(roomId, adapter);
              return;
            }
          }
        } catch (error) {
          runtime.sockets.unregister(roomId, adapter);
          throw error;
        }

        active = { roomId, playerId, adapter };
        await sendLegacy(connection.socket, {
          type: "joined",
          room: roomId,
          seat,
        });
        await runtime.websocket.sendSnapshot(adapter, roomId, playerId);
        return;
      }

      if (active === undefined) {
        throw new Error("join is required before game commands");
      }
      const clean = toCleanroomCommand(message, active.adapter.compat);
      await runtime.websocket.handleText(
        active.adapter,
        { roomId: active.roomId, playerId: active.playerId },
        JSON.stringify(clean),
      );
    } catch (error) {
      await sendLegacy(connection.socket, {
        type: "error",
        message:
          error instanceof Error ? error.message : "invalid legacy message",
      });
    }
  });
};
