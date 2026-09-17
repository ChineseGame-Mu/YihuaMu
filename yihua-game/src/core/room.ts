import {
  createTableConfig,
  SUPPORTED_PLAYER_COUNTS,
  type SupportedPlayerCount,
  type TableConfig,
} from "./table.js";

// Kept as a compatibility export for older tests/imports. Public rooms no longer expire.
export const LATE_JOIN_WINDOW_MS = 3 * 60 * 60 * 1000;

export type ParticipantKind = "human" | "robot";

export interface Participant {
  readonly id: string;
  readonly name: string;
  readonly kind: ParticipantKind;
  readonly seat: number;
  readonly connected: boolean;
  readonly readyForNextRound?: boolean;
  readonly leavingAfterRound?: boolean;
}

export interface Observer {
  readonly id: string;
  readonly name: string;
  readonly connected: boolean;
  readonly readyForNextRound: boolean;
  readonly preferredPartnerId?: string;
}

export interface RoomState {
  readonly roomId: string;
  readonly config: TableConfig;
  readonly participants: readonly Participant[];
  readonly observers: readonly Observer[];
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
  if (
    room.participants.some((participant) => participant.id === id) ||
    room.observers.some((observer) => observer.id === id)
  ) {
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
  _room: RoomState,
  _now: number = Date.now(),
): boolean => true;

export const openLateJoinWindow = (
  room: RoomState,
  _startedAt: number = Date.now(),
): RoomState => {
  const { joinClosesAt: _joinClosesAt, ...permanentRoom } = room;
  return permanentRoom;
};

const ensureJoinWindowOpen = (_room: RoomState, _now: number): void => {
  // Fixed public rooms 0001-0004 are permanent and never expire by time.
};

const expandRoomForSeat = (room: RoomState, seat: number): RoomState => {
  if (seat < room.config.playerCount) return room;
  if (seat !== room.config.playerCount) {
    throw new Error("late join must take the next available seat");
  }

  const currentIndex = SUPPORTED_PLAYER_COUNTS.indexOf(room.config.playerCount);
  const nextCount = SUPPORTED_PLAYER_COUNTS[currentIndex + 1];
  if (nextCount === undefined) {
    throw new Error("room has reached the 14-player maximum");
  }

  return {
    ...room,
    config: createTableConfig(nextCount, room.config.botCount),
  };
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
    observers: [],
  };
};

export const addObserver = (
  room: RoomState,
  input: { readonly id: string; readonly name: string },
): RoomState => {
  const id = input.id.trim();
  const name = input.name.trim();
  if (id.length === 0 || name.length === 0) {
    throw new Error("observer id and name are required");
  }
  ensureParticipantIdAvailable(room, id);
  return {
    ...room,
    observers: [
      ...room.observers,
      { id, name, connected: true, readyForNextRound: false },
    ],
  };
};

export const reconnectObserver = (room: RoomState, id: string): RoomState => ({
  ...room,
  observers: room.observers.map((observer) =>
    observer.id === id ? { ...observer, connected: true } : observer,
  ),
});

export const removeObserver = (room: RoomState, id: string): RoomState => ({
  ...room,
  observers: room.observers.filter((observer) => observer.id !== id),
});

export const setParticipationForNextRound = (
  room: RoomState,
  id: string,
  active: boolean,
  preferredPartnerId?: string,
): RoomState => {
  const observer = room.observers.find(
    ({ id: observerId }) => observerId === id,
  );
  if (observer !== undefined) {
    if (
      preferredPartnerId !== undefined &&
      !room.participants.some(
        ({ id: participantId, kind }) =>
          participantId === preferredPartnerId && kind === "human",
      )
    ) {
      throw new Error("preferred partner is not a seated human");
    }
    return {
      ...room,
      observers: room.observers.map((current) => {
        if (current.id !== id) return current;
        const { preferredPartnerId: _previousPartner, ...withoutPartner } =
          current;
        return {
          ...withoutPartner,
          readyForNextRound: active,
          ...(active && preferredPartnerId !== undefined
            ? { preferredPartnerId }
            : {}),
        };
      }),
    };
  }

  const participant = room.participants.find(
    ({ id: participantId, kind }) => participantId === id && kind === "human",
  );
  if (participant === undefined) {
    throw new Error(`human or observer ${id} does not exist`);
  }
  return {
    ...room,
    participants: room.participants.map((current) =>
      current.id === id ? { ...current, leavingAfterRound: !active } : current,
    ),
  };
};

export const addHuman = (
  room: RoomState,
  input: { readonly id: string; readonly name: string; readonly seat: number },
  now: number = Date.now(),
): RoomState => {
  ensureJoinWindowOpen(room, now);
  const human = normalizeHuman(input);
  ensureParticipantIdAvailable(room, human.id);
  const expandedRoom = expandRoomForSeat(room, human.seat);
  validateSeat(human.seat, expandedRoom.config.playerCount);
  ensureSeatAvailable(expandedRoom, human.seat);

  return {
    ...expandedRoom,
    participants: [
      ...expandedRoom.participants,
      {
        ...human,
        kind: "human",
        connected: true,
        readyForNextRound: false,
      },
    ],
  };
};

export const setReadyForNextRound = (
  room: RoomState,
  id: string,
  ready: boolean,
): RoomState => {
  const participant = room.participants.find(
    ({ id: participantId, kind }) => participantId === id && kind === "human",
  );
  if (!participant) {
    throw new Error(`human participant ${id} does not exist`);
  }
  return {
    ...room,
    participants: room.participants.map((current) =>
      current.id === id ? { ...current, readyForNextRound: ready } : current,
    ),
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
        ? {
            ...human,
            kind: "human",
            connected: true,
            readyForNextRound: false,
          }
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

export const disconnectObserver = (room: RoomState, id: string): RoomState => ({
  ...room,
  observers: room.observers.map((observer) =>
    observer.id === id ? { ...observer, connected: false } : observer,
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

export const choosePartner = (
  room: RoomState,
  playerId: string,
  partnerId: string,
): RoomState => {
  const player = room.participants.find(
    ({ id, kind }) => id === playerId && kind === "human",
  );
  const partner = room.participants.find(
    ({ id, kind }) => id === partnerId && kind === "human",
  );
  if (
    player === undefined ||
    partner === undefined ||
    player.id === partner.id
  ) {
    throw new Error("both partner choices must be different seated humans");
  }
  if (player.seat % 2 === partner.seat % 2) return room;

  const desiredSeat = Array.from(
    { length: room.config.playerCount },
    (_, seat) => seat,
  ).find(
    (seat) =>
      seat !== partner.seat &&
      seat % 2 === partner.seat % 2 &&
      room.participants.some((participant) => participant.seat === seat),
  );
  if (desiredSeat === undefined) {
    throw new Error("no occupied teammate seat is available");
  }
  const displaced = room.participants.find(({ seat }) => seat === desiredSeat)!;
  return {
    ...room,
    participants: room.participants.map((participant) => {
      if (participant.id === player.id)
        return { ...participant, seat: desiredSeat };
      if (participant.id === displaced.id)
        return { ...participant, seat: player.seat };
      return participant;
    }),
  };
};

const robotForSeat = (seat: number): Participant => ({
  id: `robot-seat-${seat + 1}`,
  name: `机器人${seat + 1}`,
  kind: "robot",
  seat,
  connected: true,
});

export const applyNextRoundParticipation = (room: RoomState): RoomState => {
  const leaving = room.participants.filter(
    ({ kind, leavingAfterRound }) =>
      kind === "human" && leavingAfterRound === true,
  );
  const remainingHumanCount = room.participants.filter(
    ({ kind, leavingAfterRound }) =>
      kind === "human" && leavingAfterRound !== true,
  ).length;
  if (leaving.length > 0 && remainingHumanCount === 0) {
    throw new Error("at least one human must remain seated");
  }

  let participants = room.participants.map((participant) =>
    participant.kind === "human" && participant.leavingAfterRound === true
      ? robotForSeat(participant.seat)
      : participant.kind === "human"
        ? { ...participant, leavingAfterRound: false }
        : participant,
  );
  let observers: Observer[] = [
    ...room.observers,
    ...leaving.map(({ id, name, connected }) => ({
      id,
      name,
      connected,
      readyForNextRound: false,
    })),
  ];

  for (const observer of observers.filter(
    ({ connected, readyForNextRound }) => connected && readyForNextRound,
  )) {
    const partner =
      observer.preferredPartnerId === undefined
        ? undefined
        : participants.find(
            ({ id, kind }) =>
              id === observer.preferredPartnerId && kind === "human",
          );
    const robots = participants
      .filter(({ kind }) => kind === "robot")
      .sort((left, right) => left.seat - right.seat);
    const robot =
      robots.find(
        ({ seat }) => partner !== undefined && seat % 2 === partner.seat % 2,
      ) ?? robots[0];
    if (robot === undefined) continue;
    participants = participants.map((participant) =>
      participant.id === robot.id
        ? {
            id: observer.id,
            name: observer.name,
            kind: "human" as const,
            seat: robot.seat,
            connected: true,
            readyForNextRound: false,
            leavingAfterRound: false,
          }
        : participant,
    );
    observers = observers.filter(({ id }) => id !== observer.id);
  }

  const botCount = participants.filter(({ kind }) => kind === "robot").length;
  return {
    ...room,
    config: createTableConfig(room.config.playerCount, botCount),
    participants,
    observers,
  };
};

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
