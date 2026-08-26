import { createLobbyState, startGame, type GameState } from "./game-state.js";
import { createRoom, roomIsReady, type RoomState } from "./room.js";
import { type SupportedPlayerCount } from "./table.js";

export interface ManagedRoom {
  readonly room: RoomState;
  readonly game: GameState;
}

export class RoomManager {
  private readonly rooms = new Map<string, ManagedRoom>();

  create(roomId: string, playerCount: SupportedPlayerCount): ManagedRoom {
    if (this.rooms.has(roomId)) {
      throw new Error(`room ${roomId} already exists`);
    }

    const room = createRoom(roomId, playerCount);
    const managed = {
      room,
      game: createLobbyState(playerCount, 0),
    } satisfies ManagedRoom;
    this.rooms.set(room.roomId, managed);
    return managed;
  }

  get(roomId: string): ManagedRoom {
    const managed = this.rooms.get(roomId);
    if (!managed) {
      throw new Error(`room ${roomId} does not exist`);
    }
    return managed;
  }

  set(roomId: string, managed: ManagedRoom): ManagedRoom {
    if (managed.room.roomId !== roomId) {
      throw new Error("managed room id mismatch");
    }
    this.rooms.set(roomId, managed);
    return managed;
  }

  delete(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }

  listRoomIds(): readonly string[] {
    return [...this.rooms.keys()].sort();
  }

  start(roomId: string, random: () => number = Math.random): ManagedRoom {
    const managed = this.get(roomId);
    if (!roomIsReady(managed.room)) {
      throw new Error("room is not ready to start");
    }
    if (managed.game.phase !== "lobby") {
      throw new Error("game has already started");
    }

    const next = {
      room: managed.room,
      game: startGame(
        createLobbyState(
          managed.room.config.playerCount,
          managed.room.config.botCount,
        ),
        random,
      ),
    } satisfies ManagedRoom;
    this.rooms.set(roomId, next);
    return next;
  }
}
