import { disconnectHuman, reconnectHuman } from "./room.js";
import type { ServerRuntime } from "./server-runtime.js";
import type { ConnectionContext, TextSocket } from "./websocket-service.js";

export interface UpgradeRequest {
  readonly path: string;
  readonly query: Readonly<Record<string, string | undefined>>;
}

export interface UpgradedConnection {
  readonly socket: TextSocket;
  readonly context: ConnectionContext;
  onText(handler: (text: string) => void | Promise<void>): void;
  onClose(handler: () => void | Promise<void>): void;
}

export const websocketContextFromRequest = (
  request: UpgradeRequest,
): ConnectionContext => {
  const match = request.path.match(/^\/ws\/rooms\/([^/]+)$/);
  if (!match) {
    throw new Error("unsupported websocket path");
  }

  const roomId = decodeURIComponent(match[1]!);
  if (roomId.trim().length === 0) {
    throw new Error("room id is required");
  }

  const playerId = request.query.playerId;
  return playerId === undefined ? { roomId } : { roomId, playerId };
};

const setExistingHumanConnection = async (
  runtime: ServerRuntime,
  roomId: string,
  playerId: string,
  connected: boolean,
): Promise<void> => {
  const managed = runtime.rooms.get(roomId);
  const participant = managed.room.participants.find(
    ({ id, kind }) => id === playerId && kind === "human",
  );
  if (!participant || participant.connected === connected) return;

  const next = runtime.rooms.set(roomId, {
    ...managed,
    room: connected
      ? reconnectHuman(managed.room, playerId)
      : disconnectHuman(managed.room, playerId),
  });
  await runtime.websocket.broadcastRoomState(next);
};

export const attachUpgradedConnection = async (
  runtime: ServerRuntime,
  connection: UpgradedConnection,
): Promise<void> => {
  const { roomId, playerId } = connection.context;
  runtime.sockets.register(roomId, connection.socket, playerId);

  if (playerId !== undefined) {
    await setExistingHumanConnection(runtime, roomId, playerId, true);
  }

  connection.onClose(async () => {
    runtime.sockets.unregister(roomId, connection.socket);
    if (
      playerId !== undefined &&
      runtime.sockets.playerConnectionCount(roomId, playerId) === 0
    ) {
      try {
        await setExistingHumanConnection(runtime, roomId, playerId, false);
      } catch {
        // The room may already have been removed while the socket was closing.
      }
    }
  });

  await runtime.websocket.sendSnapshot(connection.socket, roomId);

  connection.onText(async (text) => {
    await runtime.websocket.handleText(
      connection.socket,
      connection.context,
      text,
    );
  });
};
