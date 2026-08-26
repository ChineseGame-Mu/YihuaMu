import { RoomManager } from "./room-manager.js";
import { RoomSocketHub } from "./room-socket-hub.js";
import { WebSocketService } from "./websocket-service.js";

export interface ServerRuntime {
  readonly rooms: RoomManager;
  readonly sockets: RoomSocketHub;
  readonly websocket: WebSocketService;
}

export const createServerRuntime = (): ServerRuntime => {
  const rooms = new RoomManager();
  const sockets = new RoomSocketHub();
  return {
    rooms,
    sockets,
    websocket: new WebSocketService(rooms, sockets),
  };
};
