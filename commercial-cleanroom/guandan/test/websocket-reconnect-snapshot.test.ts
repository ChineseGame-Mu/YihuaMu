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

      const expectedRevision = rooms.get(roomId).revision;
      expect(expectedRevision).toBe(playerCount + 1);

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
        expect(messages.map(({ revision }) => revision)).toEqual([
          expectedRevision,
          expectedRevision,
          expectedRevision,
        ]);
        const privateHand = messages[2]!;
        expect(privateHand.seat).toBe(reconnectSeat);
        expect(Array.isArray(privateHand.cards)).toBe(true);
        expect(privateHand.cards).toHaveLength(27);
      }

      const spectator = new RecordingSocket();
      await service.sendSnapshot(spectator, roomId);
      const spectatorMessages = spectator.messages.map(
        (message) => JSON.parse(message) as Record<string, unknown>,
      );
      expect(spectatorMessages.map(({ type }) => type)).toEqual([
        "room_state",
        "game_state",
      ]);
      expect(spectatorMessages.map(({ revision }) => revision)).toEqual([
        expectedRevision,
        expectedRevision,
      ]);
    });
  }

  it("does not advance the state revision for ping traffic", async () => {
    const rooms = new RoomManager();
    const service = new WebSocketService(rooms, new RoomSocketHub());
    const roomId = "revision-ping-room";
    rooms.create(roomId, 4);

    const socket = new RecordingSocket();
    const before = rooms.get(roomId).revision;
    await service.handleText(
      socket,
      { roomId },
      JSON.stringify({ type: "ping", nonce: "heartbeat-1" }),
    );

    expect(rooms.get(roomId).revision).toBe(before);
    expect(JSON.parse(socket.messages[0]!) as Record<string, unknown>).toEqual({
      type: "pong",
      nonce: "heartbeat-1",
    });
  });
});
