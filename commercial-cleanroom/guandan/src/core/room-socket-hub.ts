import type { TextSocket } from "./websocket-service.js";

interface SocketRegistration {
  readonly socket: TextSocket;
  readonly playerId?: string;
}

export class RoomSocketHub {
  private readonly registrationsByRoom = new Map<
    string,
    Set<SocketRegistration>
  >();

  register(roomId: string, socket: TextSocket, playerId?: string): void {
    const registrations =
      this.registrationsByRoom.get(roomId) ?? new Set<SocketRegistration>();
    registrations.add(
      playerId === undefined ? { socket } : { socket, playerId },
    );
    this.registrationsByRoom.set(roomId, registrations);
  }

  unregister(roomId: string, socket: TextSocket): void {
    const registrations = this.registrationsByRoom.get(roomId);
    if (!registrations) return;

    for (const registration of registrations) {
      if (registration.socket === socket) {
        registrations.delete(registration);
      }
    }

    if (registrations.size === 0) {
      this.registrationsByRoom.delete(roomId);
    }
  }

  count(roomId: string): number {
    return this.registrationsByRoom.get(roomId)?.size ?? 0;
  }

  playerConnectionCount(roomId: string, playerId: string): number {
    return [...(this.registrationsByRoom.get(roomId) ?? [])].filter(
      (registration) => registration.playerId === playerId,
    ).length;
  }

  async sendToPlayer(
    roomId: string,
    playerId: string,
    text: string,
  ): Promise<void> {
    const registrations = [...(this.registrationsByRoom.get(roomId) ?? [])];
    await Promise.all(
      registrations
        .filter((registration) => registration.playerId === playerId)
        .map(({ socket }) => Promise.resolve(socket.send(text))),
    );
  }

  async broadcast(roomId: string, text: string): Promise<void> {
    const registrations = [...(this.registrationsByRoom.get(roomId) ?? [])];
    await Promise.all(
      registrations.map(({ socket }) => Promise.resolve(socket.send(text))),
    );
  }
}
