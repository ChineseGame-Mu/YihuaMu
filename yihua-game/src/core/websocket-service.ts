import {
  encodeServerMessage,
  parseClientMessage,
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
    phase: managed.game.phase,
    currentTurn: managed.game.currentTurn,
    handCounts: managed.game.hands.map((hand) => hand.length),
    openingDraw: finalDraw.cards.map(({ card }) => card),
    openingDrawWinner: managed.game.openingDraw.winnerSeat,
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
    seat: participant.seat,
    cards: hand.map(({ id, card }) => ({ id, card })),
  };
};

export class WebSocketService {
  constructor(
    private readonly rooms: RoomManager,
    private readonly sockets: RoomSocketHub,
  ) {}

  async handleText(
    socket: TextSocket,
    context: ConnectionContext,
    raw: string,
  ): Promise<ManagedRoom> {
    try {
      const message = parseClientMessage(raw);
      const managed = this.rooms.get(context.roomId);

      if (message.type === "start_game") {
        const next = this.rooms.start(context.roomId);
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

      if (result.response.type === "room_state") {
        await this.sockets.broadcast(
          context.roomId,
          encodeServerMessage(result.response),
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
    await socket.send(encodeServerMessage(roomStateMessage(managed.room)));

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
      encodeServerMessage(roomStateMessage(managed.room)),
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
