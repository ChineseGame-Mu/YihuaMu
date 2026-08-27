import {
  encodeServerMessage,
  parseClientMessage,
  type ClientMessage,
  type ServerMessage,
} from "./protocol.js";
import { roomStateMessage, applyClientMessage } from "./session.js";
import { RoomManager, type ManagedRoom } from "./room-manager.js";
import { RoomSocketHub } from "./room-socket-hub.js";

export interface TextSocket {
  send(text: string): void | Promise<void>;
  close?(code?: number, reason?: string): void | Promise<void>;
}

export interface ConnectionContext {
  readonly roomId: string;
  readonly playerId?: string;
}

type RoomStateMessage = Extract<ServerMessage, { readonly type: "room_state" }>;
type MutatingMessage = Exclude<ClientMessage, { readonly type: "ping" }>;

const versionedRoomStateMessage = (managed: ManagedRoom): RoomStateMessage => ({
  ...roomStateMessage(managed.room),
  revision: managed.revision,
});

const gameStateMessage = (managed: ManagedRoom): ServerMessage | null => {
  if (managed.game.phase === "lobby" || managed.game.phase === "opening-draw") {
    return null;
  }

  const finalDraw = managed.game.openingDraw.attempts.at(-1);
  if (!finalDraw) {
    throw new Error("opening draw is missing");
  }

  return {
    type: "game_state",
    roomId: managed.room.roomId,
    revision: managed.revision,
    phase: managed.game.phase,
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
    finishedSeats: managed.game.finishedSeats ?? [],
    completedTricks: managed.game.trick.completedTricks,
  };
};

const privateHandMessage = (
  managed: ManagedRoom,
  playerId: string,
): ServerMessage | null => {
  if (managed.game.phase === "lobby" || managed.game.phase === "opening-draw") {
    return null;
  }

  const participant = managed.room.participants.find(
    ({ id, kind }) => id === playerId && kind === "human",
  );
  if (!participant) return null;

  const hand = managed.game.hands[participant.seat];
  if (!hand) return null;

  return {
    type: "private_hand",
    roomId: managed.room.roomId,
    revision: managed.revision,
    seat: participant.seat,
    cards: hand.map(({ id, card }) => ({ id, card })),
  };
};

export class WebSocketService {
  private readonly processedCommands = new Map<string, Set<string>>();

  constructor(
    private readonly rooms: RoomManager,
    private readonly sockets: RoomSocketHub,
  ) {}

  private hasProcessed(roomId: string, commandId: string): boolean {
    return this.processedCommands.get(roomId)?.has(commandId) ?? false;
  }

  private rememberCommand(roomId: string, commandId?: string): void {
    if (commandId === undefined) return;
    const commands = this.processedCommands.get(roomId) ?? new Set<string>();
    commands.add(commandId);
    while (commands.size > 512) {
      const oldest = commands.values().next().value as string | undefined;
      if (oldest === undefined) break;
      commands.delete(oldest);
    }
    this.processedCommands.set(roomId, commands);
  }

  private async rejectStaleRevision(
    socket: TextSocket,
    expectedRevision: number,
    actualRevision: number,
  ): Promise<void> {
    const response: ServerMessage = {
      type: "error",
      code: "stale_revision",
      message: `expected revision ${expectedRevision}, current revision is ${actualRevision}`,
    };
    await socket.send(encodeServerMessage(response));
  }

  private async guardMutation(
    socket: TextSocket,
    context: ConnectionContext,
    managed: ManagedRoom,
    message: MutatingMessage,
  ): Promise<boolean> {
    if (
      message.commandId !== undefined &&
      this.hasProcessed(context.roomId, message.commandId)
    ) {
      await this.sendSnapshot(socket, context.roomId, context.playerId);
      return false;
    }

    if (
      message.expectedRevision !== undefined &&
      message.expectedRevision !== managed.revision
    ) {
      await this.rejectStaleRevision(
        socket,
        message.expectedRevision,
        managed.revision,
      );
      return false;
    }

    return true;
  }

  async handleText(
    socket: TextSocket,
    context: ConnectionContext,
    raw: string,
  ): Promise<ManagedRoom> {
    try {
      const message = parseClientMessage(raw);
      const managed = this.rooms.get(context.roomId);

      if (message.type === "ping") {
        const result = applyClientMessage(managed.room, message);
        await socket.send(encodeServerMessage(result.response));
        return managed;
      }

      if (!(await this.guardMutation(socket, context, managed, message))) {
        return managed;
      }

      if (message.type === "start_game") {
        const next = this.rooms.start(context.roomId);
        this.rememberCommand(context.roomId, message.commandId);
        await this.broadcastRoomState(next);
        await this.broadcastGameState(next);
        await this.sendPrivateHands(next);
        return next;
      }

      const result = applyClientMessage(managed.room, message);
      const next = this.rooms.set(context.roomId, {
        ...managed,
        room: result.room,
      });
      this.rememberCommand(context.roomId, message.commandId);

      if (result.response.type === "room_state") {
        await this.sockets.broadcast(
          context.roomId,
          encodeServerMessage(versionedRoomStateMessage(next)),
        );
      } else {
        await socket.send(encodeServerMessage(result.response));
      }
      return next;
    } catch (error) {
      const response: ServerMessage = {
        type: "error",
        code: "invalid_message",
        message: error instanceof Error ? error.message : "unknown error",
      };
      await socket.send(encodeServerMessage(response));
      return this.rooms.get(context.roomId);
    }
  }

  async sendSnapshot(
    socket: TextSocket,
    roomId: string,
    playerId?: string,
  ): Promise<void> {
    const managed = this.rooms.get(roomId);
    await socket.send(encodeServerMessage(versionedRoomStateMessage(managed)));

    const publicGame = gameStateMessage(managed);
    if (publicGame) {
      await socket.send(encodeServerMessage(publicGame));
    }

    if (playerId !== undefined) {
      const privateHand = privateHandMessage(managed, playerId);
      if (privateHand) {
        await socket.send(encodeServerMessage(privateHand));
      }
    }
  }

  async broadcastRoomState(managed: ManagedRoom): Promise<void> {
    await this.sockets.broadcast(
      managed.room.roomId,
      encodeServerMessage(versionedRoomStateMessage(managed)),
    );
  }

  async broadcastGameState(managed: ManagedRoom): Promise<void> {
    const message = gameStateMessage(managed);
    if (!message) return;
    await this.sockets.broadcast(
      managed.room.roomId,
      encodeServerMessage(message),
    );
  }

  async sendPrivateHands(managed: ManagedRoom): Promise<void> {
    for (const participant of managed.room.participants) {
      if (participant.kind !== "human") continue;
      const message = privateHandMessage(managed, participant.id);
      if (!message) continue;
      await this.sockets.sendToPlayer(
        managed.room.roomId,
        participant.id,
        encodeServerMessage(message),
      );
    }
  }
}
