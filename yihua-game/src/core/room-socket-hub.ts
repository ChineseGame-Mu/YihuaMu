import type { TextSocket } from "./websocket-service.js";

export class RoomSocketHub {
  private readonly socketsByRoom = new Map<string, Set<TextSocket>>();

  register(roomId: string, socket: TextSocket): void {
    const sockets = this.socketsByRoom.get(roomId) ?? new Set<TextSocket>();
    sockets.add(socket);
    this.socketsByRoom.set(roomId, sockets);
  }

  unregister(roomId: string, socket: TextSocket): void {
    const sockets = this.socketsByRoom.get(roomId);
    if (!sockets) return;
    sockets.delete(socket);
    if (sockets.size === 0) {
      this.socketsByRoom.delete(roomId);
    }
  }

  count(roomId: string): number {
    return this.socketsByRoom.get(roomId)?.size ?? 0;
  }

  async broadcast(roomId: string, text: string): Promise<void> {
    const sockets = [...(this.socketsByRoom.get(roomId) ?? [])];
    await Promise.all(sockets.map((socket) => Promise.resolve(socket.send(text))));
  }
}
