import type { GameState } from "./game-state.js";
import type { ManagedRoom } from "./room-manager.js";
import type { RoomState } from "./room.js";

export interface RuntimeSnapshot {
  readonly version: 1;
  readonly rooms: readonly RuntimeRoomSnapshot[];
}

export interface RuntimeRoomSnapshot {
  readonly roomId: string;
  readonly room: RoomState;
  readonly game: GameState;
  readonly revision: number;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const createRuntimeSnapshot = (
  rooms: readonly ManagedRoom[],
): RuntimeSnapshot => ({
  version: 1,
  rooms: rooms.map((managed) => ({
    roomId: managed.room.roomId,
    room: clone(managed.room),
    game: clone(managed.game),
    revision: managed.revision,
  })),
});

export const parseRuntimeSnapshot = (raw: string): RuntimeSnapshot => {
  const value = JSON.parse(raw) as Partial<RuntimeSnapshot>;
  if (value.version !== 1 || !Array.isArray(value.rooms)) {
    throw new Error("unsupported runtime snapshot");
  }
  return value as RuntimeSnapshot;
};
