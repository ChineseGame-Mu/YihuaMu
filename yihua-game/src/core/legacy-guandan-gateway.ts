import {
  gameStateToLegacy,
  privateHandToLegacy,
  roomStateToLegacyWaiting,
  toCleanroomCommand,
  type FrontendCompatState,
  type LegacyClientMessage,
  type LegacyServerMessage,
} from "./frontend-compat.js";
import type { ServerMessage } from "./protocol.js";
import {
  disconnectHuman,
  reconnectHuman,
  replaceRobotWithHuman,
} from "./room.js";
import type { ServerRuntime } from "./server-runtime.js";
import type { SupportedPlayerCount } from "./table.js";
import type { TextSocket } from "./websocket-service.js";
import type { UpgradedConnection } from "./websocket-upgrade.js";

const LEGACY_PENDING_ROOM = "__legacy_guandan_pending__";

type LegacyStateMessage = Extract<
  LegacyServerMessage,
  { readonly type: "state" }
>;

interface PendingLegacyTrick {
  readonly completedTricks: number;
  readonly winner: number;
  readonly lastPlay: LegacyStateMessage["last_play"];
  readonly tablePlays: LegacyStateMessage["table_plays"];
}

const pendingLegacyTricks = new Map<string, PendingLegacyTrick>();

const sendLegacy = async (
  socket: TextSocket,
  message: LegacyServerMessage,
): Promise<void> => {
  await socket.send(JSON.stringify(message));
};

const parseLegacyClientMessage = (raw: string): LegacyClientMessage => {
  const parsed = JSON.parse(raw) as Partial<LegacyClientMessage>;
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    typeof parsed.type !== "string"
  ) {
    throw new Error("legacy message must be an object with a type");
  }
  return parsed as LegacyClientMessage;
};

const legacyPlayerId = (name: string): string => {
  const normalized = name.trim();
  if (normalized.length === 0) throw new Error("player name is required");
  return `legacy:${normalized}`;
};

class LegacyAdapterSocket implements TextSocket {
  private roomState:
    | Extract<ServerMessage, { readonly type: "room_state" }>
    | undefined;
  private gameState:
    | Extract<ServerMessage, { readonly type: "game_state" }>
    | undefined;
  private startedRevision: number | undefined;
  private completedTricks = 0;
  private tablePlays: LegacyStateMessage["table_plays"] = [];
  readonly compat: {
    roomId: string;
    playerId: string;
    seat: number | null;
    privateCardIds: string[];
  };

  constructor(
    private readonly socket: TextSocket,
    initial: FrontendCompatState,
  ) {
    this.compat = {
      roomId: initial.roomId,
      playerId: initial.playerId,
      seat: initial.seat,
      privateCardIds: [...initial.privateCardIds],
    };
  }

  private async sendCurrentLegacyState(): Promise<void> {
    if (this.roomState === undefined || this.gameState === undefined) return;
    const legacyState = gameStateToLegacy(this.roomState, this.gameState);
    if (legacyState.type !== "state") return;
    const pending = pendingLegacyTricks.get(this.compat.roomId);
    await sendLegacy(this.socket, {
      ...legacyState,
      last_play: pending?.lastPlay ?? legacyState.last_play,
      last_player: pending?.winner ?? legacyState.last_player,
      table_plays: pending?.tablePlays ?? this.tablePlays,
      passes: pending === undefined ? legacyState.passes : 0,
      trick_complete: pending !== undefined,
      last_trick_winner: pending?.winner ?? null,
    });
  }

  async send(text: string): Promise<void> {
    const message = JSON.parse(text) as ServerMessage;
    switch (message.type) {
      case "room_state":
        this.roomState = message;
        await sendLegacy(this.socket, roomStateToLegacyWaiting(message));
        if (this.gameState?.phase === "round-complete") {
          await this.sendCurrentLegacyState();
        }
        return;
      case "private_hand":
        this.compat.privateCardIds.splice(
          0,
          this.compat.privateCardIds.length,
          ...message.cards.map(({ id }) => id),
        );
        await sendLegacy(this.socket, privateHandToLegacy(message));
        return;
      case "game_state": {
        const previousGameState = this.gameState;
        this.gameState = message;
        if (this.roomState === undefined) return;
        if (this.startedRevision === undefined) {
          this.startedRevision = message.revision;
          await sendLegacy(this.socket, {
            type: "started",
            player_count: message.handCounts.length,
            cards_per_player: message.handCounts[0] ?? 0,
          });
        }

        if (
          previousGameState !== undefined &&
          message.phase === "playing" &&
          message.completedTricks > this.completedTricks
        ) {
          const previousLegacy = gameStateToLegacy(
            this.roomState,
            previousGameState,
          );
          if (
            previousLegacy.type === "state" &&
            previousLegacy.last_player !== null &&
            previousLegacy.last_play.length > 0 &&
            this.tablePlays.length > 0 &&
            !pendingLegacyTricks.has(this.compat.roomId)
          ) {
            pendingLegacyTricks.set(this.compat.roomId, {
              completedTricks: message.completedTricks,
              winner: previousLegacy.last_player,
              lastPlay: previousLegacy.last_play,
              tablePlays: this.tablePlays,
            });
          }
        }

        if (
          message.phase === "round-complete" ||
          message.completedTricks < this.completedTricks
        ) {
          pendingLegacyTricks.delete(this.compat.roomId);
          this.tablePlays = [];
        }
        this.completedTricks = message.completedTricks;

        const legacyState = gameStateToLegacy(this.roomState, message);
        if (legacyState.type !== "state") return;
        const pending = pendingLegacyTricks.get(this.compat.roomId);
        const currentPlay = legacyState.table_plays[0];
        if (pending === undefined && currentPlay !== undefined) {
          this.tablePlays = [
            ...this.tablePlays.filter(
              ({ player }) => player !== currentPlay.player,
            ),
            currentPlay,
          ];
        } else if (
          pending === undefined &&
          currentPlay === undefined &&
          message.phase === "playing"
        ) {
          this.tablePlays = [];
        }

        await this.sendCurrentLegacyState();
        return;
      }
      case "error":
        await sendLegacy(this.socket, {
          type: "error",
          message: message.message,
        });
        return;
      case "pong":
        return;
    }
  }

  close(code?: number, reason?: string): void | Promise<void> {
    if (this.socket.close === undefined) return;
    return this.socket.close(code, reason);
  }
}

const supportedPlayerCount = (value: unknown): SupportedPlayerCount => {
  const count = Number(value);
  return count === 4 ||
    count === 6 ||
    count === 8 ||
    count === 10 ||
    count === 12 ||
    count === 14
    ? count
    : 4;
};

const ensureLegacyRoom = (
  runtime: ServerRuntime,
  roomId: string,
  requestedPlayerCount: unknown,
): void => {
  try {
    runtime.rooms.get(roomId);
  } catch {
    runtime.rooms.create(roomId, supportedPlayerCount(requestedPlayerCount));
  }
};

export const assertLegacyNextRoundRole = (
  message: LegacyClientMessage,
  seat: number | null,
  game: Extract<ServerMessage, { readonly type: "game_state" }>,
): void => {
  if (
    message.type !== "shuffle_next_round" &&
    message.type !== "deal_next_round"
  ) {
    return;
  }
  if (seat === null) throw new Error("a seated player is required");
  if (game.phase !== "round-complete") {
    throw new Error("round is not complete");
  }
  const winner = game.finishedSeats[0];
  if (winner === undefined) throw new Error("previous winner is unavailable");

  if (message.type === "shuffle_next_round" && seat % 2 === winner % 2) {
    throw new Error("only the losing team may shuffle for the next round");
  }
  if (message.type === "deal_next_round" && seat !== winner) {
    throw new Error("only the previous winner may deal the next round");
  }
};

export const attachLegacyGuandanConnection = async (
  runtime: ServerRuntime,
  connection: UpgradedConnection,
): Promise<void> => {
  await sendLegacy(connection.socket, {
    type: "connected",
    protocol: "yihua-cleanroom-guandan-v1",
  });

  let active:
    | {
        roomId: string;
        playerId: string;
        adapter: LegacyAdapterSocket;
      }
    | undefined;

  connection.onClose(async () => {
    if (active === undefined) return;
    runtime.sockets.unregister(active.roomId, active.adapter);
    if (
      runtime.sockets.playerConnectionCount(active.roomId, active.playerId) > 0
    ) {
      return;
    }
    try {
      const managed = runtime.rooms.get(active.roomId);
      const next = runtime.rooms.set(active.roomId, {
        ...managed,
        room: disconnectHuman(managed.room, active.playerId),
      });
      await runtime.websocket.broadcastRoomState(next);
    } catch {
      // Room may have been removed while the socket was closing.
    }
  });

  connection.onText(async (raw) => {
    try {
      const message = parseLegacyClientMessage(raw);
      if (message.type === "join") {
        if (active !== undefined) {
          throw new Error("connection already joined a room");
        }
        const requestedRoomId =
          connection.context.roomId === LEGACY_PENDING_ROOM
            ? message.room
            : connection.context.roomId;
        const roomId = requestedRoomId.trim();
        if (roomId.length === 0) throw new Error("room id is required");
        const playerId = legacyPlayerId(message.name);
        const requestedPlayerCount = (
          message as LegacyClientMessage & { readonly player_count?: number }
        ).player_count;
        ensureLegacyRoom(runtime, roomId, requestedPlayerCount);

        let managed = runtime.rooms.get(roomId);
        const existing = managed.room.participants.find(
          ({ id, kind }) => id === playerId && kind === "human",
        );
        const robotSeat = [...managed.room.participants]
          .filter(({ kind }) => kind === "robot")
          .sort((a, b) => a.seat - b.seat)[0]?.seat;
        const seat =
          existing?.seat ?? robotSeat ?? managed.room.participants.length;
        const adapter = new LegacyAdapterSocket(connection.socket, {
          roomId,
          playerId,
          seat,
          privateCardIds: [],
        });

        try {
          runtime.sockets.register(roomId, adapter, playerId);
          if (existing !== undefined) {
            if (!existing.connected) {
              managed = runtime.rooms.set(roomId, {
                ...managed,
                room: reconnectHuman(managed.room, playerId),
              });
              await runtime.websocket.broadcastRoomState(managed);
            }
          } else if (robotSeat !== undefined) {
            managed = runtime.rooms.set(roomId, {
              ...managed,
              room: replaceRobotWithHuman(managed.room, {
                id: playerId,
                name: message.name,
                seat: robotSeat,
              }),
            });
            await runtime.websocket.broadcastRoomState(managed);
          } else {
            await runtime.websocket.handleText(
              adapter,
              { roomId, playerId },
              JSON.stringify({
                type: "join_room",
                roomId,
                playerId,
                name: message.name,
                seat,
              }),
            );
            const joined = runtime.rooms
              .get(roomId)
              .room.participants.some(
                ({ id, kind }) => id === playerId && kind === "human",
              );
            if (!joined) {
              runtime.sockets.unregister(roomId, adapter);
              return;
            }
          }
        } catch (error) {
          runtime.sockets.unregister(roomId, adapter);
          throw error;
        }

        active = { roomId, playerId, adapter };
        await sendLegacy(connection.socket, {
          type: "joined",
          room: roomId,
          seat,
        });
        await runtime.websocket.sendSnapshot(adapter, roomId, playerId);
        return;
      }

      if (active === undefined) {
        throw new Error("join is required before game commands");
      }
      if (message.type === "end_round") {
        const pending = pendingLegacyTricks.get(active.roomId);
        if (
          pending !== undefined &&
          active.adapter.compat.seat !== pending.winner
        ) {
          throw new Error("only the completed trick winner may clear the table");
        }
        pendingLegacyTricks.delete(active.roomId);
        await runtime.websocket.broadcastGameState(
          runtime.rooms.get(active.roomId),
        );
        return;
      }
      if (
        message.type === "shuffle_next_round" ||
        message.type === "deal_next_round"
      ) {
        const managed = runtime.rooms.get(active.roomId);
        if (managed.game.phase !== "round-complete") {
          throw new Error("round is not complete");
        }
        const finalDraw = managed.game.openingDraw.attempts.at(-1);
        if (finalDraw === undefined) throw new Error("opening draw is missing");
        assertLegacyNextRoundRole(message, active.adapter.compat.seat, {
          type: "game_state",
          roomId: active.roomId,
          revision: managed.revision,
          phase: "round-complete",
          currentTurn: managed.game.currentTurn,
          handCounts: managed.game.hands.map((hand) => hand.length),
          openingDraw: finalDraw.cards.map(({ card }) => card),
          openingDrawWinner: managed.game.openingDraw.winnerSeat,
          leadingPlay:
            managed.game.trick.leadingPlay === null
              ? null
              : {
                  seat: managed.game.trick.leadingPlay.seat,
                  cards: managed.game.trick.leadingPlay.cards,
                },
          passedSeats: managed.game.trick.passedSeats,
          finishedSeats: managed.game.finishedSeats,
          completedTricks: managed.game.trick.completedTricks,
        });
      }
      const clean = toCleanroomCommand(message, active.adapter.compat);
      await runtime.websocket.handleText(
        active.adapter,
        { roomId: active.roomId, playerId: active.playerId },
        JSON.stringify(clean),
      );
    } catch (error) {
      await sendLegacy(connection.socket, {
        type: "error",
        message:
          error instanceof Error ? error.message : "invalid legacy message",
      });
    }
  });
};
