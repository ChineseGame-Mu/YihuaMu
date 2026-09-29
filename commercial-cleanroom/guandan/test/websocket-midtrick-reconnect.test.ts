import { describe, expect, it } from "vitest";
import { passGameTurn, playGameCards } from "../src/core/game-state.js";
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

describe("websocket mid-trick reconnect recovery", () => {
  for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
    it(`restores public trick state after play and pass for ${playerCount} players`, async () => {
      const rooms = new RoomManager();
      const sockets = new RoomSocketHub();
      const service = new WebSocketService(rooms, sockets);
      const roomId = `midtrick-reconnect-${playerCount}`;

      rooms.create(roomId, playerCount);
      for (let seat = 0; seat < playerCount; seat += 1) {
        await service.handleText(
          new RecordingSocket(),
          { roomId, playerId: `p${seat}` },
          JSON.stringify({
            type: "join_room",
            roomId,
            playerId: `p${seat}`,
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

      const started = rooms.get(roomId);
      if (started.game.phase !== "playing")
        throw new Error("game did not start");
      const leader = started.game.currentTurn;
      const leadCard = started.game.hands[leader]![0]!.card;
      const afterPlay = playGameCards(started.game, leader, [leadCard]);
      if (afterPlay.phase !== "playing")
        throw new Error("single play completed round");
      const passer = afterPlay.currentTurn;
      const afterPass = passGameTurn(afterPlay, passer);
      rooms.set(roomId, { ...started, game: afterPass });

      const reconnecting = new RecordingSocket();
      await service.sendSnapshot(reconnecting, roomId, `p${passer}`);
      const gameState = reconnecting.messages
        .map((message) => JSON.parse(message) as Record<string, unknown>)
        .find(({ type }) => type === "game_state");

      expect(gameState).toBeDefined();
      expect(gameState?.currentTurn).toBe(afterPass.currentTurn);
      expect(gameState?.handCounts).toEqual(
        afterPass.hands.map((hand) => hand.length),
      );
      expect(gameState?.leadingPlay).toEqual({
        seat: leader,
        cards: [leadCard],
      });
      expect(gameState?.passedSeats).toEqual(afterPass.trick.passedSeats);
      expect(gameState?.finishedSeats).toEqual(afterPass.finishedSeats ?? []);
      expect(gameState?.completedTricks).toBe(afterPass.trick.completedTricks);
    });
  }
});
