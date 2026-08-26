import { RoomManager } from "./room-manager.js";
import { WebSocketService } from "./websocket-service.js";

export interface ServerRuntime {
  readonly rooms: RoomManager;
  readonly websocket: WebSocketService;
}

export const createServerRuntime = (): ServerRuntime => {
  const rooms = new RoomManager();
  return {
    rooms,
    websocket: new WebSocketService(rooms),
  };
};
