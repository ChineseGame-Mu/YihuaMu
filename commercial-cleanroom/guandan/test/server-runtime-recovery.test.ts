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
  private closeHandler: (() => void | Promise<void>) | undefined;

  constructor(readonly context: ConnectionContext) {}

  onText(handler: (text: string) => void | Promise<void>): void {
    this.textHandler = handler;
  }

  onClose(handler: () => void | Promise<void>): void {
    this.closeHandler = handler;
  }

  async close(): Promise<void> {
    await this.closeHandler?.();
  }
}

const deterministicRandom = (): (() => number) => {
  let state = 0x31415926;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

describe("server runtime recovery", () => {
  it("preserves the active game while requiring humans to reconnect", async () => {
    const firstRuntime = createServerRuntime();
    let managed = firstRuntime.rooms.create("runtime-recovery", 4);

    for (let seat = 0; seat < 4; seat += 1) {
      managed = firstRuntime.rooms.set("runtime-recovery", {
        ...managed,
        room: addHuman(managed.room, {
          id: `p${seat}`,
          name: `玩家${seat + 1}`,
          seat,
        }),
      });
    }

    const started = firstRuntime.rooms.start(
      "runtime-recovery",
      deterministicRandom(),
    );
    expect(started.game.phase).toBe("playing");
    if (started.game.phase !== "playing") return;

    const snapshot = firstRuntime.snapshot();
    const recoveredRuntime = createServerRuntime(snapshot);
    const recovered = recoveredRuntime.rooms.get("runtime-recovery");

    expect(recovered.revision).toBe(started.revision);
    expect(recovered.game).toEqual(started.game);
    expect(
      recovered.room.participants
        .filter(({ kind }) => kind === "human")
        .every(({ connected }) => connected === false),
    ).toBe(true);

    const handCountsBefore = started.game.hands.map((hand) => hand.length);
    const currentTurnBefore = started.game.currentTurn;
    const connection = new FakeConnection({
      roomId: "runtime-recovery",
      playerId: "p0",
    });

    await attachUpgradedConnection(recoveredRuntime, connection);
    const afterReconnect = recoveredRuntime.rooms.get("runtime-recovery");
    expect(
      afterReconnect.room.participants.find(({ id }) => id === "p0")?.connected,
    ).toBe(true);
    expect(afterReconnect.game.phase).toBe("playing");
    if (afterReconnect.game.phase !== "playing") return;
    expect(afterReconnect.game.currentTurn).toBe(currentTurnBefore);
    expect(afterReconnect.game.hands.map((hand) => hand.length)).toEqual(
      handCountsBefore,
    );

    const messages = connection.socket.sent.map(
      (text) => JSON.parse(text) as { type: string; revision?: number },
    );
    expect(messages.some(({ type }) => type === "game_state")).toBe(true);
    expect(messages.some(({ type }) => type === "private_hand")).toBe(true);
    expect(
      messages
        .filter(({ revision }) => revision !== undefined)
        .every(({ revision }) => revision === afterReconnect.revision),
    ).toBe(true);
  });
});
