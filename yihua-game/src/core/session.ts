import {
  addHuman,
  removeParticipant,
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
  })),
});

export const applyClientMessage = (
  room: RoomState,
  message: SessionClientMessage,
): SessionResult => {
  switch (message.type) {
    case "join_room": {
      if (message.roomId !== room.roomId) {
        throw new Error("message room id does not match active room");
      }
      const nextRoom = addHuman(room, {
        id: message.playerId,
        name: message.name,
        seat: message.seat,
      });
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
    case "ping":
      return {
        room,
        response: { type: "pong", nonce: message.nonce },
      };
  }
};
