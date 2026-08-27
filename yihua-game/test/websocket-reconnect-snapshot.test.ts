import { describe, expect, it } from "vitest";
import { RoomManager } from "../src/core/room-manager.js";
import { RoomSocketHub } from "../src/core/room-socket-hub.js";
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
  it("restores room, public game state, and only the reconnecting player's private hand", async () => {
    const rooms = new RoomManager();
    const sockets = new RoomSocketHub();
    const service = new WebSocketService(rooms, sockets);
    const roomId = "reconnect-room";

    rooms.create(roomId, 4);
    const playerIds = ["p0", "p1", "p2", "p3"];
    for (const playerId of playerIds) {
      await service.handleText(
        new RecordingSocket(),
        { roomId },
        JSON.stringify({ type: "join", playerId }),
      );
    }
    await service.handleText(
      new RecordingSocket(),
      { roomId },
      JSON.stringify({ type: "start_game" }),
    );

    const reconnecting = new RecordingSocket();
    await service.sendSnapshot(reconnecting, roomId, "p2");
    const messages = reconnecting.messages.map(
      (message) => JSON.parse(message) as Record<string, unknown>,
    );

    expect(messages.map(({ type }) => type)).toEqual([
      "room_state",
      "game_state",
      "private_hand",
    ]);
    const privateHand = messages[2]!;
    expect(privateHand.seat).toBe(2);
    expect(Array.isArray(privateHand.cards)).toBe(true);
    expect(privateHand.cards).toHaveLength(27);

    const spectator = new RecordingSocket();
    await service.sendSnapshot(spectator, roomId);
    const spectatorTypes = spectator.messages.map(
      (message) => (JSON.parse(message) as { type: string }).type,
    );
    expect(spectatorTypes).toEqual(["room_state", "game_state"]);
  });
});
