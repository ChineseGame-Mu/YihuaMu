import type { ManagedRoom } from "./room-manager.js";
import { isSupportedPlayerCount } from "./table.js";

export interface ManagedRoomSnapshot {
  readonly version: 1;
  readonly savedAt: string;
  readonly managed: ManagedRoom;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function assertManagedRoomShape(
  managed: unknown,
): asserts managed is ManagedRoom {
  if (!isRecord(managed)) throw new Error("snapshot managed room is missing");
  if (!Number.isInteger(managed.revision) || Number(managed.revision) < 0) {
    throw new Error("snapshot revision is invalid");
  }
  if (!isRecord(managed.room) || typeof managed.room.roomId !== "string") {
    throw new Error("snapshot room is invalid");
  }
  if (!isRecord(managed.room.config)) {
    throw new Error("snapshot room config is invalid");
  }
  const playerCount = Number(managed.room.config.playerCount);
  if (!isSupportedPlayerCount(playerCount)) {
    throw new Error("snapshot player count is invalid");
  }
  if (!Array.isArray(managed.room.participants)) {
    throw new Error("snapshot participants are invalid");
  }
  if (!isRecord(managed.game) || typeof managed.game.phase !== "string") {
    throw new Error("snapshot game is invalid");
  }
  if (!isRecord(managed.game.config)) {
    throw new Error("snapshot game config is invalid");
  }
  if (Number(managed.game.config.playerCount) !== playerCount) {
    throw new Error("snapshot game and room player counts differ");
  }
}

export const encodeManagedRoomSnapshot = (managed: ManagedRoom): string =>
  JSON.stringify({
    version: 1,
    savedAt: new Date().toISOString(),
    managed,
  } satisfies ManagedRoomSnapshot);

export const decodeManagedRoomSnapshot = (text: string): ManagedRoom => {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed) || parsed.version !== 1) {
    throw new Error("unsupported room snapshot version");
  }
  assertManagedRoomShape(parsed.managed);

  return {
    ...parsed.managed,
    room: {
      ...parsed.managed.room,
      participants: parsed.managed.room.participants.map((participant) =>
        participant.kind === "human"
          ? { ...participant, connected: false }
          : participant,
      ),
    },
  };
};
