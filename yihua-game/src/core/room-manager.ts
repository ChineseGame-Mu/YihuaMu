import { passGameSeat, playGameCardIds } from "./game-actions.js";
import {
  createLobbyState,
  startGame,
  startNextRound,
  type GameState,
} from "./game-state.js";
import {
  createRoom,
  openLateJoinWindow,
  roomIsReady,
  setRobotCount,
  type RoomState,
} from "./room.js";
import { type SupportedPlayerCount } from "./table.js";

export interface ManagedRoom {
  readonly room: RoomState;
  readonly game: GameState;
  readonly revision: number;
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

    const humans = managed.room.participants.filter(
      ({ kind }) => kind === "human",
    );
    if (humans.length === 0) {
      throw new Error("at least one human is required to start");
    }
    if (humans.some(({ connected }) => !connected)) {
      throw new Error("all seated humans must be connected to start");
    }

    const robotCount = managed.room.config.playerCount - humans.length;
    const filledRoom = setRobotCount(managed.room, robotCount);
    if (!roomIsReady(filledRoom)) {
      throw new Error("room is not ready to start");
    }
    const startedRoom = openLateJoinWindow(filledRoom, now());

    const next = {
      room: startedRoom,
      game: startGame(
        createLobbyState(
          startedRoom.config.playerCount,
          startedRoom.config.botCount,
        ),
        random,
      ),
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

    const next = {
      ...managed,
      game: startNextRound(managed.game, random),
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