import {
  createTableConfig,
  type SupportedPlayerCount,
  type TableConfig,
} from "./table.js";

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

export const createRoom = (
  roomId: string,
  playerCount: SupportedPlayerCount,
): RoomState => {
  const normalizedRoomId = roomId.trim();
  if (normalizedRoomId.length === 0) {
    throw new Error("room id is required");
  }

  return {
    roomId: normalizedRoomId,
    config: createTableConfig(playerCount, 0),
    participants: [],
  };
};

export const addHuman = (
  room: RoomState,
  input: { readonly id: string; readonly name: string; readonly seat: number },
): RoomState => {
  const id = input.id.trim();
  const name = input.name.trim();
  if (id.length === 0 || name.length === 0) {
    throw new Error("human id and name are required");
  }

  validateSeat(input.seat, room.config.playerCount);
  ensureSeatAvailable(room, input.seat);
  ensureParticipantIdAvailable(room, id);

  return {
    ...room,
    participants: [
      ...room.participants,
      {
        id,
        name,
        kind: "human",
        seat: input.seat,
        connected: true,
      },
    ],
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
