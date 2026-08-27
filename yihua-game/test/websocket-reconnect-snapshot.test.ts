import { describe, expect, it } from "vitest";
import { RoomManager } from "../src/core/room-manager.js";
import { RoomSocketHub } from "../src/core/room-socket-hub.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";
import {
  WebSocketService,
  type TextSocket,
} from "../src/core/websocket-service.js";

class RecordingSocket implements TextSocket {
  readonly messages: string[] = [];
  send(text: string): void {
    this.messages.push(text);
  }
}

describe("websocket reconnect snapshot recovery", () => {
  for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
    it(`restores every player's private hand after reconnect for ${playerCount} players`, async () => {
      const rooms = new RoomManager();
      const sockets = new RoomSocketHub();
      const service = new WebSocketService(rooms, sockets);
      const roomId = `reconnect-room-${playerCount}`;

      rooms.create(roomId, playerCount);
      const playerIds = Array.from(
        { length: playerCount },
        (_, seat) => `p${seat}`,
      );
      for (const [seat, playerId] of playerIds.entries()) {
        await service.handleText(
          new RecordingSocket(),
          { roomId, playerId },
          JSON.stringify({
            type: "join_room",
            roomId,
            playerId,
            name: `Player ${seat + 1}`,
            seat,
          }),
        );
      }
      await service.handleText(
        new RecordingSocket(),
        { roomId, playerId: "p0" },
        JSON.stringify({ type: "start_game" }),
      );

      for (const [reconnectSeat, playerId] of playerIds.entries()) {
        const reconnecting = new RecordingSocket();
        await service.sendSnapshot(reconnecting, roomId, playerId);
        const messages = reconnecting.messages.map(
          (message) => JSON.parse(message) as Record<string, unknown>,
        );

        expect(messages.map(({ type }) => type)).toEqual([
          "room_state",
          "game_state",
          "private_hand",
        ]);
        const privateHand = messages[2]!;
        expect(privateHand.seat).toBe(reconnectSeat);
        expect(Array.isArray(privateHand.cards)).toBe(true);
        expect(privateHand.cards).toHaveLength(27);
      }

      const spectator = new RecordingSocket();
      await service.sendSnapshot(spectator, roomId);
      const spectatorTypes = spectator.messages.map(
        (message) => (JSON.parse(message) as { type: string }).type,
      );
      expect(spectatorTypes).toEqual(["room_state", "game_state"]);
    });
  }
});
