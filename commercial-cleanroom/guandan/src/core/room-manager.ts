import {
  applyPromotion,
  initialTeamLevels,
  promotionForPlacements,
} from "./competition.js";
import { passGameSeat, playGameCardIds } from "./game-actions.js";
import {
  createLobbyState,
  startGame,
  startNextRound,
  type GameState,
} from "./game-state.js";
import {
  prepareNativeTribute,
  submitNativeReturnTribute,
  submitNativeTribute,
  type NativeTributeState,
} from "./native-tribute.js";
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
  readonly tribute?: NativeTributeState | undefined;
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

const isAbandonedActiveRoom = (managed: ManagedRoom): boolean => {
  if (managed.game.phase === "lobby") return false;
  const humans = managed.room.participants.filter(
    ({ kind }) => kind === "human",
  );
  return humans.length > 0 && humans.every(({ connected }) => !connected);
};

const tributePending = (managed: ManagedRoom): boolean =>
  managed.tribute !== undefined && managed.tribute.status !== "complete";

export class RoomManager {
  private readonly rooms = new Map<string, ManagedRoom>();
  private readonly restoredRoomsAwaitingReconnect = new Set<string>();

  create(roomId: string, playerCount: SupportedPlayerCount): ManagedRoom {
    if (this.rooms.has(roomId)) {
      throw new Error(`room ${roomId} already exists`);
    }

    const room = createRoom(roomId, playerCount);
    const managed = {
      room,
      game: createLobbyState(playerCount, 0),
      revision: 0,
      tribute: undefined,
    } satisfies ManagedRoom;
    this.rooms.set(room.roomId, managed);
    return managed;
  }

  get(roomId: string): ManagedRoom {
    const managed = this.rooms.get(roomId);
    if (!managed) {
      throw new Error(`room ${roomId} does not exist`);
    }

    if (
      isAbandonedActiveRoom(managed) &&
      !this.restoredRoomsAwaitingReconnect.has(roomId)
    ) {
      const reset = {
        room: createRoom(roomId, managed.room.config.playerCount),
        game: createLobbyState(managed.room.config.playerCount, 0),
        revision: managed.revision + 1,
        tribute: undefined,
      } satisfies ManagedRoom;
      this.rooms.set(roomId, reset);
      return reset;
    }

    return managed;
  }

  set(roomId: string, managed: ManagedRoom): ManagedRoom {
    if (managed.room.roomId !== roomId) {
      throw new Error("managed room id mismatch");
    }
    const current = this.get(roomId);
    const next = { ...managed, revision: current.revision + 1 };
    this.restoredRoomsAwaitingReconnect.delete(roomId);
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
    if (isAbandonedActiveRoom(managed)) {
      this.restoredRoomsAwaitingReconnect.add(roomId);
    }
    return managed;
  }

  delete(roomId: string): boolean {
    this.restoredRoomsAwaitingReconnect.delete(roomId);
    return this.rooms.delete(roomId);
  }

  listRoomIds(): readonly string[] {
    return [...this.rooms.keys()].sort();
  }

  list(): readonly ManagedRoom[] {
    return this.listRoomIds().map((roomId) => this.rooms.get(roomId)!);
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
    if (
      managed.room.participants.some(
        ({ kind, connected }) => kind === "human" && !connected,
      )
    ) {
      throw new Error("all seated humans must be connected to start");
    }

    const participantCount = managed.room.participants.length;
    if (!isSupportedPlayerCount(participantCount)) {
      throw new Error("start requires 4, 6, 8, 10, 12, or 14 seated players");
    }
    if (participantCount > managed.room.config.playerCount) {
      throw new Error("player count exceeds tonight's selected player count");
    }

    const botCount = managed.room.participants.filter(
      ({ kind }) => kind === "robot",
    ).length;
    const startedRoom = openLateJoinWindow(managed.room, now());
    const next = {
      room: startedRoom,
      game: startGame(createLobbyState(participantCount, botCount), random),
      revision: managed.revision + 1,
      tribute: undefined,
    } satisfies ManagedRoom;
    this.restoredRoomsAwaitingReconnect.delete(roomId);
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

    let nextLevelRank = completed.levelRank;
    let nextTeamLevels = completed.teamLevels;
    let matchWinner = completed.matchWinner ?? null;

    if (
      activeCount === 4 &&
      completed.placements.length === 4 &&
      completed.outcome !== null
    ) {
      const levels = completed.teamLevels ?? initialTeamLevels();
      const promotion = promotionForPlacements(completed.placements, levels);
      nextTeamLevels = applyPromotion(levels, promotion);
      nextLevelRank = promotion.after;
      if (promotion.passedA) matchWinner = promotion.team;
    }

    const nextGame = startNextRound(
      completed,
      random,
      nextLevelRank,
      nextTeamLevels,
      matchWinner,
    );
    const tribute =
      activeCount === 4 && completed.placements.length === 4
        ? prepareNativeTribute(completed.placements, nextGame)
        : undefined;

    const next = {
      ...managed,
      game: nextGame,
      revision: managed.revision + 1,
      tribute,
    } satisfies ManagedRoom;
    this.restoredRoomsAwaitingReconnect.delete(roomId);
    this.rooms.set(roomId, next);
    return next;
  }

  submitTribute(
    roomId: string,
    seat: number,
    cardId: string,
  ): ManagedRoom {
    const managed = this.get(roomId);
    if (managed.game.phase !== "playing" || managed.tribute === undefined) {
      throw new Error("no native tribute exchange is active");
    }
    const mutation = submitNativeTribute(
      managed.game,
      managed.tribute,
      seat,
      cardId,
    );
    const next = {
      ...managed,
      game: mutation.game,
      tribute: mutation.tribute,
      revision: managed.revision + 1,
    } satisfies ManagedRoom;
    this.rooms.set(roomId, next);
    return next;
  }

  submitReturnTribute(
    roomId: string,
    seat: number,
    cardId: string,
  ): ManagedRoom {
    const managed = this.get(roomId);
    if (managed.game.phase !== "playing" || managed.tribute === undefined) {
      throw new Error("no native tribute exchange is active");
    }
    const mutation = submitNativeReturnTribute(
      managed.game,
      managed.tribute,
      seat,
      cardId,
    );
    const next = {
      ...managed,
      game: mutation.game,
      tribute: mutation.tribute,
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
    if (tributePending(managed)) {
      throw new Error("tribute exchange must finish before play");
    }

    const next = {
      ...managed,
      game: playGameCardIds(managed.game, seat, cardIds),
      revision: managed.revision + 1,
    } satisfies ManagedRoom;
    this.restoredRoomsAwaitingReconnect.delete(roomId);
    this.rooms.set(roomId, next);
    return next;
  }

  pass(roomId: string, seat: number): ManagedRoom {
    const managed = this.get(roomId);
    if (managed.game.phase !== "playing") {
      throw new Error("game is not accepting passes");
    }
    if (tributePending(managed)) {
      throw new Error("tribute exchange must finish before play");
    }

    const next = {
      ...managed,
      game: passGameSeat(managed.game, seat),
      revision: managed.revision + 1,
    } satisfies ManagedRoom;
    this.restoredRoomsAwaitingReconnect.delete(roomId);
    this.rooms.set(roomId, next);
    return next;
  }
}
