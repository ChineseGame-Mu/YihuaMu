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

export const attachUpgradedConnection = async (
  runtime: ServerRuntime,
  connection: UpgradedConnection,
): Promise<void> => {
  runtime.sockets.register(connection.context.roomId, connection.socket);
  connection.onClose(() => {
    runtime.sockets.unregister(connection.context.roomId, connection.socket);
  });

  await runtime.websocket.sendSnapshot(
    connection.socket,
    connection.context.roomId,
  );

  connection.onText(async (text) => {
    await runtime.websocket.handleText(
      connection.socket,
      connection.context,
      text,
    );
  });
};
