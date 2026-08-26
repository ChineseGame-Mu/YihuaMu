import { encodeServerMessage, parseClientMessage, type ServerMessage } from "./protocol.js";
import { roomStateMessage, applyClientMessage } from "./session.js";
import { RoomManager, type ManagedRoom } from "./room-manager.js";

export interface TextSocket {
  send(text: string): void | Promise<void>;
  close?(code?: number, reason?: string): void | Promise<void>;
}

export interface ConnectionContext {
  readonly roomId: string;
  readonly playerId?: string;
}

export class WebSocketService {
  constructor(private readonly rooms: RoomManager) {}

  async handleText(
    socket: TextSocket,
    context: ConnectionContext,
    raw: string,
  ): Promise<ManagedRoom> {
    try {
      const message = parseClientMessage(raw);
      const managed = this.rooms.get(context.roomId);

      if (message.type === "start_game") {
        const next = this.rooms.start(context.roomId);
        await socket.send(
          encodeServerMessage({
            type: "room_state",
            roomId: next.room.roomId,
            playerCount: next.room.config.playerCount,
            robotCount: next.room.config.botCount,
            participants: next.room.participants,
          }),
        );
        return next;
      }

      const result = applyClientMessage(managed.room, message);
      const next = this.rooms.set(context.roomId, {
        ...managed,
        room: result.room,
      });
      await socket.send(encodeServerMessage(result.response));
      return next;
    } catch (error) {
      const response: ServerMessage = {
        type: "error",
        code: "invalid_message",
        message: error instanceof Error ? error.message : "unknown error",
      };
      await socket.send(encodeServerMessage(response));
      return this.rooms.get(context.roomId);
    }
  }

  async sendSnapshot(socket: TextSocket, roomId: string): Promise<void> {
    const managed = this.rooms.get(roomId);
    await socket.send(encodeServerMessage(roomStateMessage(managed.room)));
  }
}
