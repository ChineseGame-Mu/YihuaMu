import {
  addHuman,
  removeParticipant,
  replaceRobotWithHuman,
  setReadyForNextRound,
  setRobotCount,
  type RoomState,
} from "./room.js";
import { type ClientMessage, type ServerMessage } from "./protocol.js";

type RoomStateServerMessage = Extract<
  ServerMessage,
  { readonly type: "room_state" }
>;
type SessionClientMessage = Exclude<
  ClientMessage,
  | { readonly type: "start_game" }
  | { readonly type: "next_round" }
  | { readonly type: "play_cards" }
  | { readonly type: "pass_turn" }
>;

export interface SessionResult {
  readonly room: RoomState;
  readonly response: ServerMessage;
}

export const roomStateMessage = (room: RoomState): RoomStateServerMessage => ({
  type: "room_state",
  roomId: room.roomId,
  playerCount: room.config.playerCount,
  robotCount: room.config.botCount,
  participants: room.participants.map((participant) => ({
    id: participant.id,
    name: participant.name,
    seat: participant.seat,
    kind: participant.kind,
    connected: participant.connected,
    readyForNextRound: participant.readyForNextRound,
  })),
});

export const applyClientMessage = (
  room: RoomState,
  message: SessionClientMessage,
  actingPlayerId?: string,
): SessionResult => {
  switch (message.type) {
    case "join_room": {
      if (message.roomId !== room.roomId) {
        throw new Error("message room id does not match active room");
      }
      const occupied = room.participants.find(
        (participant) => participant.seat === message.seat,
      );
      const joinInput = {
        id: message.playerId,
        name: message.name,
        seat: message.seat,
      };
      const nextRoom =
        occupied?.kind === "robot"
          ? replaceRobotWithHuman(room, joinInput)
          : addHuman(room, joinInput);
      return { room: nextRoom, response: roomStateMessage(nextRoom) };
    }
    case "leave_room": {
      const nextRoom = removeParticipant(room, message.playerId);
      return { room: nextRoom, response: roomStateMessage(nextRoom) };
    }
    case "set_robots": {
      const nextRoom = setRobotCount(room, message.count);
      return { room: nextRoom, response: roomStateMessage(nextRoom) };
    }
    case "set_next_round_ready": {
      if (actingPlayerId === undefined) {
        throw new Error(
          "player identity is required to choose next-round entry",
        );
      }
      const nextRoom = setReadyForNextRound(
        room,
        actingPlayerId,
        message.ready,
      );
      return { room: nextRoom, response: roomStateMessage(nextRoom) };
    }
    case "ping":
      return {
        room,
        response: { type: "pong", nonce: message.nonce },
      };
    default: {
      const exhaustive: never = message;
      throw new Error(`unsupported session message: ${String(exhaustive)}`);
    }
  }
};
