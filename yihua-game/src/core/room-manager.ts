import { passGameSeat, playGameCardIds } from "./game-actions.js";
import {
  createLobbyState,
  startGame,
  startNextRound,
  type GameState,
} from "./game-state.js";
import { createRoom, openLateJoinWindow, type RoomState } from "./room.js";
import {
  isSupportedPlayerCount,
  SUPPORTED_PLAYER_COUNTS,
  type SupportedPlayerCount,
} from "./table.js";

export interface ManagedRoom {
  readonly room: RoomState;
  readonly game: GameState;
  readonly revision: number;
}

const activeCountForNextRound = (
  managed: ManagedRoom,
): SupportedPlayerCount => {
  const currentCount = managed.game.config.playerCount;
  const target = managed.room.config.playerCount;
  const participantsBySeat = new Map(
    managed.room.participants.map((participant) => [
      participant.seat,
      participant,
    ]),
  );

  let contiguousEligibleCount = currentCount;
  while (contiguousEligibleCount < target) {
    const participant = participantsBySeat.get(contiguousEligibleCount);
    if (
      participant === undefined ||
      participant.kind !== "human" ||
      !participant.connected ||
      participant.readyForNextRound !== true
    ) {
      break;
    }
    contiguousEligibleCount += 1;
  }

  const eligible = SUPPORTED_PLAYER_COUNTS.filter(
    (count) =>
      count >= currentCount &&
      count <= contiguousEligibleCount &&
      count <= target,
  );
  return eligible.at(-1) ?? currentCount;
};

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
      revision: 0,
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
    const current = this.get(roomId);
    const next = { ...managed, revision: current.revision + 1 };
    this.rooms.set(roomId, next);
    return next;
  }

  restore(managed: ManagedRoom): ManagedRoom {
    const roomId = managed.room.roomId;
    if (this.rooms.has(roomId)) {
      throw new Error(`room ${roomId} already exists`);
    }
    if (!Number.isInteger(managed.revision) || managed.revision < 0) {
      throw new Error("room revision must be a non-negative integer");
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

  list(): readonly ManagedRoom[] {
    return this.listRoomIds().map((roomId) => this.get(roomId));
  }

  start(
    roomId: string,
    random: () => number = Math.random,
    now: () => number = Date.now,
  ): ManagedRoom {
    const managed = this.get(roomId);
    if (managed.game.phase !== "lobby") {
      throw new Error("game has already started");
    }
    if (managed.room.participants.some(({ kind }) => kind !== "human")) {
      throw new Error("this table requires human players only");
    }
    if (managed.room.participants.some(({ connected }) => !connected)) {
      throw new Error("all seated humans must be connected to start");
    }

    const humanCount = managed.room.participants.length;
    if (!isSupportedPlayerCount(humanCount)) {
      throw new Error("start requires 4, 6, 8, 10, 12, or 14 connected humans");
    }
    if (humanCount > managed.room.config.playerCount) {
      throw new Error("human count exceeds tonight's selected player count");
    }

    const startedRoom = openLateJoinWindow(managed.room, now());
    const next = {
      room: startedRoom,
      game: startGame(createLobbyState(humanCount, 0), random),
      revision: managed.revision + 1,
    } satisfies ManagedRoom;
    this.rooms.set(roomId, next);
    return next;
  }

  nextRound(roomId: string, random: () => number = Math.random): ManagedRoom {
    const managed = this.get(roomId);
    if (managed.game.phase !== "round-complete") {
      throw new Error("round is not complete");
    }

    const activeCount = activeCountForNextRound(managed);
    const completed =
      activeCount === managed.game.config.playerCount
        ? managed.game
        : {
            ...managed.game,
            config: { ...managed.game.config, playerCount: activeCount },
          };
    const next = {
      ...managed,
      game: startNextRound(completed, random),
      revision: managed.revision + 1,
    } satisfies ManagedRoom;
    this.rooms.set(roomId, next);
    return next;
  }

  play(roomId: string, seat: number, cardIds: readonly string[]): ManagedRoom {
    const managed = this.get(roomId);
    if (managed.game.phase !== "playing") {
      throw new Error("game is not accepting plays");
    }

    const next = {
      ...managed,
      game: playGameCardIds(managed.game, seat, cardIds),
      revision: managed.revision + 1,
    } satisfies ManagedRoom;
    this.rooms.set(roomId, next);
    return next;
  }

  pass(roomId: string, seat: number): ManagedRoom {
    const managed = this.get(roomId);
    if (managed.game.phase !== "playing") {
      throw new Error("game is not accepting passes");
    }

    const next = {
      ...managed,
      game: passGameSeat(managed.game, seat),
      revision: managed.revision + 1,
    } satisfies ManagedRoom;
    this.rooms.set(roomId, next);
    return next;
  }
}
