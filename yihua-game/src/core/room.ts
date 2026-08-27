import {
  createTableConfig,
  type SupportedPlayerCount,
  type TableConfig,
} from "./table.js";

export const LATE_JOIN_WINDOW_MS = 3 * 60 * 60 * 1000;

export type ParticipantKind = "human" | "robot";

export interface Participant {
  readonly id: string;
  readonly name: string;
  readonly kind: ParticipantKind;
  readonly seat: number;
  readonly connected: boolean;
}

export interface RoomState {
  readonly roomId: string;
  readonly config: TableConfig;
  readonly participants: readonly Participant[];
  readonly joinClosesAt?: number;
}

const validateSeat = (
  seat: number,
  playerCount: SupportedPlayerCount,
): void => {
  if (!Number.isInteger(seat) || seat < 0 || seat >= playerCount) {
    throw new Error(
      `seat must be an integer from 0 through ${playerCount - 1}`,
    );
  }
};

const ensureSeatAvailable = (room: RoomState, seat: number): void => {
  if (room.participants.some((participant) => participant.seat === seat)) {
    throw new Error(`seat ${seat} is already occupied`);
  }
};

const ensureParticipantIdAvailable = (room: RoomState, id: string): void => {
  if (room.participants.some((participant) => participant.id === id)) {
    throw new Error(`participant ${id} already exists`);
  }
};

const normalizeHuman = (input: {
  readonly id: string;
  readonly name: string;
  readonly seat: number;
}): { readonly id: string; readonly name: string; readonly seat: number } => {
  const id = input.id.trim();
  const name = input.name.trim();
  if (id.length === 0 || name.length === 0) {
    throw new Error("human id and name are required");
  }
  return { id, name, seat: input.seat };
};

export const roomAcceptsLateJoin = (
  room: RoomState,
  now: number = Date.now(),
): boolean => room.joinClosesAt === undefined || now <= room.joinClosesAt;

const ensureJoinWindowOpen = (room: RoomState, now: number): void => {
  if (!roomAcceptsLateJoin(room, now)) {
    throw new Error("three-hour join window has closed");
  }
};

export const createRoom = (
  roomId: string,
  playerCount: SupportedPlayerCount,
  now: number = Date.now(),
): RoomState => {
  const normalizedRoomId = roomId.trim();
  if (normalizedRoomId.length === 0) {
    throw new Error("room id is required");
  }

  return {
    roomId: normalizedRoomId,
    config: createTableConfig(playerCount, 0),
    participants: [],
    joinClosesAt: now + LATE_JOIN_WINDOW_MS,
  };
};

export const addHuman = (
  room: RoomState,
  input: { readonly id: string; readonly name: string; readonly seat: number },
  now: number = Date.now(),
): RoomState => {
  ensureJoinWindowOpen(room, now);
  const human = normalizeHuman(input);
  validateSeat(human.seat, room.config.playerCount);
  ensureSeatAvailable(room, human.seat);
  ensureParticipantIdAvailable(room, human.id);

  return {
    ...room,
    participants: [
      ...room.participants,
      {
        ...human,
        kind: "human",
        connected: true,
      },
    ],
  };
};

export const replaceRobotWithHuman = (
  room: RoomState,
  input: { readonly id: string; readonly name: string; readonly seat: number },
  now: number = Date.now(),
): RoomState => {
  ensureJoinWindowOpen(room, now);
  const human = normalizeHuman(input);
  validateSeat(human.seat, room.config.playerCount);
  ensureParticipantIdAvailable(room, human.id);
  const robot = room.participants.find(
    (participant) =>
      participant.seat === human.seat && participant.kind === "robot",
  );
  if (!robot) {
    throw new Error(`seat ${human.seat} is not available for a late join`);
  }

  return {
    ...room,
    config: createTableConfig(
      room.config.playerCount,
      Math.max(0, room.config.botCount - 1),
    ),
    participants: room.participants.map((participant) =>
      participant.id === robot.id
        ? { ...human, kind: "human", connected: true }
        : participant,
    ),
  };
};

export const disconnectHuman = (room: RoomState, id: string): RoomState => ({
  ...room,
  participants: room.participants.map((participant) =>
    participant.id === id && participant.kind === "human"
      ? { ...participant, connected: false }
      : participant,
  ),
});

export const reconnectHuman = (room: RoomState, id: string): RoomState => ({
  ...room,
  participants: room.participants.map((participant) =>
    participant.id === id && participant.kind === "human"
      ? { ...participant, connected: true }
      : participant,
  ),
});

export const removeParticipant = (room: RoomState, id: string): RoomState => ({
  ...room,
  participants: room.participants.filter(
    (participant) => participant.id !== id,
  ),
});

export const setRobotCount = (room: RoomState, count: number): RoomState => {
  const humanParticipants = room.participants.filter(
    (participant) => participant.kind === "human",
  );

  const config = createTableConfig(room.config.playerCount, count);
  if (humanParticipants.length + count > room.config.playerCount) {
    throw new Error("humans plus robots cannot exceed table size");
  }

  const occupiedSeats = new Set(humanParticipants.map(({ seat }) => seat));
  const freeSeats = Array.from(
    { length: room.config.playerCount },
    (_, seat) => seat,
  ).filter((seat) => !occupiedSeats.has(seat));

  const robots: Participant[] = freeSeats
    .slice(0, count)
    .map((seat, index) => ({
      id: `robot-${index + 1}`,
      name: `机器人${index + 1}`,
      kind: "robot",
      seat,
      connected: true,
    }));

  return {
    ...room,
    config,
    participants: [...humanParticipants, ...robots],
  };
};

export const roomIsReady = (room: RoomState): boolean =>
  room.participants.length === room.config.playerCount &&
  room.participants.every(({ connected }) => connected);
