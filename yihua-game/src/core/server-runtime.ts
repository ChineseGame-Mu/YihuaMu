import { RoomManager } from "./room-manager.js";
import { RoomSocketHub } from "./room-socket-hub.js";
import {
  createRuntimeSnapshot,
  type RuntimeSnapshot,
} from "./runtime-snapshot.js";
import { WebSocketService } from "./websocket-service.js";

export interface ServerRuntime {
  readonly rooms: RoomManager;
  readonly sockets: RoomSocketHub;
  readonly websocket: WebSocketService;
  snapshot(): RuntimeSnapshot;
}

export const createServerRuntime = (
  snapshot?: RuntimeSnapshot,
): ServerRuntime => {
  const rooms = new RoomManager();
  for (const saved of snapshot?.rooms ?? []) {
    rooms.restore({
      room: {
        ...saved.room,
        participants: saved.room.participants.map((participant) =>
          participant.kind === "human"
            ? { ...participant, connected: false }
            : participant,
        ),
      },
      game: saved.game,
      revision: saved.revision,
    });
  }
  const sockets = new RoomSocketHub();
  return {
    rooms,
    sockets,
    websocket: new WebSocketService(rooms, sockets),
    snapshot: () => createRuntimeSnapshot(rooms.list()),
  };
};
