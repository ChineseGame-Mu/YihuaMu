import { describe, expect, it } from "vitest";

import { addHuman } from "../src/core/room.js";
import { createServerRuntime } from "../src/core/server-runtime.js";
import type {
  ConnectionContext,
  TextSocket,
} from "../src/core/websocket-service.js";
import {
  attachUpgradedConnection,
  type UpgradedConnection,
} from "../src/core/websocket-upgrade.js";

class RecordingSocket implements TextSocket {
  readonly sent: string[] = [];

  send(text: string): void {
    this.sent.push(text);
  }
}

class FakeConnection implements UpgradedConnection {
  readonly socket = new RecordingSocket();
  private textHandler: ((text: string) => void | Promise<void>) | undefined;

  constructor(readonly context: ConnectionContext) {}

  onText(handler: (text: string) => void | Promise<void>): void {
    this.textHandler = handler;
  }

  onClose(_handler: () => void | Promise<void>): void {}

  async receive(text: string): Promise<void> {
    await this.textHandler?.(text);
  }
}

const deterministicRandom = (): (() => number) => {
  let state = 0x27182818;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

describe("live websocket trick completion", () => {
  it("returns the lead after every other active player passes", async () => {
    const runtime = createServerRuntime();
    let managed = runtime.rooms.create("trick-complete", 4);

    for (let seat = 0; seat < 4; seat += 1) {
      managed = runtime.rooms.set("trick-complete", {
        ...managed,
        room: addHuman(managed.room, {
          id: `p${seat}`,
          name: `玩家${seat + 1}`,
          seat,
        }),
      });
    }

    const started = runtime.rooms.start(
      "trick-complete",
      deterministicRandom(),
    );
    expect(started.game.phase).toBe("playing");
    if (started.game.phase !== "playing") return;

    const connections = new Map<number, FakeConnection>();
    for (const participant of started.room.participants) {
      if (participant.kind !== "human") continue;
      const connection = new FakeConnection({
        roomId: "trick-complete",
        playerId: participant.id,
      });
      await attachUpgradedConnection(runtime, connection);
      connections.set(participant.seat, connection);
    }

    const leaderSeat = started.game.currentTurn;
    const selected = started.game.hands[leaderSeat]?.[0];
    const leaderConnection = connections.get(leaderSeat);
    expect(selected).toBeDefined();
    expect(leaderConnection).toBeDefined();
    if (!selected || !leaderConnection) return;

    let revision = runtime.rooms.get("trick-complete").revision;
    await leaderConnection.receive(
      JSON.stringify({
        type: "play_cards",
        cardIds: [selected.id],
        expectedRevision: revision,
        commandId: "lead-card",
      }),
    );

    let state = runtime.rooms.get("trick-complete");
    expect(state.game.phase).toBe("playing");
    if (state.game.phase !== "playing") return;

    for (let passIndex = 0; passIndex < 3; passIndex += 1) {
      const seat = state.game.currentTurn;
      expect(seat).not.toBe(leaderSeat);
      const connection = connections.get(seat);
      expect(connection).toBeDefined();
      if (!connection) return;

      revision = state.revision;
      await connection.receive(
        JSON.stringify({
          type: "pass_turn",
          expectedRevision: revision,
          commandId: `pass-${passIndex}`,
        }),
      );
      state = runtime.rooms.get("trick-complete");
      expect(state.game.phase).toBe("playing");
      if (state.game.phase !== "playing") return;
    }

    expect(state.game.currentTurn).toBe(leaderSeat);
    expect(state.game.trick.leaderSeat).toBe(leaderSeat);
    expect(state.game.trick.leadingPlay).toBeNull();
    expect(state.game.trick.passedSeats).toEqual([]);
    expect(state.game.trick.completedTricks).toBe(1);
  });
});
