import { describe, expect, it } from "vitest";

import { attachLegacyGuandanConnection } from "../src/core/legacy-guandan-gateway.js";
import { createServerRuntime } from "../src/core/server-runtime.js";
import type {
  ConnectionContext,
  TextSocket,
} from "../src/core/websocket-service.js";
import type { UpgradedConnection } from "../src/core/websocket-upgrade.js";

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

  async receive(message: unknown): Promise<void> {
    await this.textHandler?.(JSON.stringify(message));
  }

  async close(): Promise<void> {
    await this.closeHandler?.();
  }
}

interface LegacyState {
  readonly type: "state";
  readonly turn: number;
  readonly table_plays: readonly {
    readonly player: number;
    readonly cards: readonly unknown[];
  }[];
  readonly last_player: number | null;
  readonly trick_complete: boolean;
  readonly last_trick_winner: number | null;
}

const latestState = (connection: FakeConnection): LegacyState => {
  const state = connection.socket.sent
    .map((text) => JSON.parse(text) as { readonly type?: string })
    .filter((message): message is LegacyState => message.type === "state")
    .at(-1);
  if (state === undefined) throw new Error("legacy state is missing");
  return state;
};

describe("legacy completed-trick display compatibility", () => {
  it("keeps the completed trick visible until the winner clears it", async () => {
    const runtime = createServerRuntime();
    const roomId = "legacy-trick-clear";
    const connections = new Map<number, FakeConnection>();

    for (let seat = 0; seat < 4; seat += 1) {
      const connection = new FakeConnection({ roomId });
      await attachLegacyGuandanConnection(runtime, connection);
      await connection.receive({
        type: "join",
        room: roomId,
        name: `玩家${seat + 1}`,
        player_count: 4,
      });
      connections.set(seat, connection);
    }

    await connections.get(0)!.receive({ type: "start", player_count: 4 });
    let managed = runtime.rooms.get(roomId);
    expect(managed.game.phase).toBe("playing");
    if (managed.game.phase !== "playing") return;

    const leaderSeat = managed.game.currentTurn;
    await connections.get(leaderSeat)!.receive({
      type: "play",
      card_indexes: [0],
    });

    managed = runtime.rooms.get(roomId);
    expect(managed.game.phase).toBe("playing");
    if (managed.game.phase !== "playing") return;

    for (let passIndex = 0; passIndex < 3; passIndex += 1) {
      const passingSeat = managed.game.currentTurn;
      expect(passingSeat).not.toBe(leaderSeat);
      await connections.get(passingSeat)!.receive({ type: "pass" });
      managed = runtime.rooms.get(roomId);
      expect(managed.game.phase).toBe("playing");
      if (managed.game.phase !== "playing") return;
    }

    expect(managed.game.trick.completedTricks).toBe(1);
    expect(managed.game.trick.leadingPlay).toBeNull();
    expect(managed.game.currentTurn).toBe(leaderSeat);

    for (const connection of connections.values()) {
      const state = latestState(connection);
      expect(state.trick_complete).toBe(true);
      expect(state.last_trick_winner).toBe(leaderSeat);
      expect(state.last_player).toBe(leaderSeat);
      expect(state.table_plays.length).toBeGreaterThan(0);
    }

    await connections.get(leaderSeat)!.receive({ type: "end_round" });

    managed = runtime.rooms.get(roomId);
    expect(managed.game.phase).toBe("playing");
    if (managed.game.phase !== "playing") return;
    expect(managed.game.trick.completedTricks).toBe(1);
    expect(managed.game.currentTurn).toBe(leaderSeat);

    for (const connection of connections.values()) {
      const state = latestState(connection);
      expect(state.trick_complete).toBe(false);
      expect(state.last_trick_winner).toBeNull();
      expect(state.last_player).toBeNull();
      expect(state.table_plays).toEqual([]);
    }
  });
});
