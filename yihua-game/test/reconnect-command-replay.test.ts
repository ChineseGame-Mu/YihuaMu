import { describe, expect, it } from "vitest";

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

  async receive(text: string): Promise<void> {
    await this.textHandler?.(text);
  }

  async triggerClose(): Promise<void> {
    await this.closeHandler?.();
  }
}

describe("command replay across reconnect", () => {
  it("deduplicates the old command and accepts the next revision", async () => {
    const runtime = createServerRuntime();
    runtime.rooms.create("replay-room", 4);

    const first = new FakeConnection({ roomId: "replay-room", playerId: "p1" });
    await attachUpgradedConnection(runtime, first);

    const joinCommand = JSON.stringify({
      type: "join_room",
      roomId: "replay-room",
      playerId: "p1",
      name: "玩家1",
      seat: 0,
      expectedRevision: 0,
      commandId: "join-1",
    });
    await first.receive(joinCommand);
    expect(runtime.rooms.get("replay-room").revision).toBe(1);

    await first.triggerClose();
    expect(runtime.rooms.get("replay-room").revision).toBe(2);
    expect(
      runtime.rooms.get("replay-room").room.participants[0]?.connected,
    ).toBe(false);

    const second = new FakeConnection({
      roomId: "replay-room",
      playerId: "p1",
    });
    await attachUpgradedConnection(runtime, second);
    expect(runtime.rooms.get("replay-room").revision).toBe(3);

    await second.receive(joinCommand);
    expect(runtime.rooms.get("replay-room").revision).toBe(3);
    expect(runtime.rooms.get("replay-room").room.participants).toHaveLength(1);

    await second.receive(
      JSON.stringify({
        type: "set_robots",
        count: 3,
        expectedRevision: 3,
        commandId: "robots-after-reconnect",
      }),
    );

    const current = runtime.rooms.get("replay-room");
    expect(current.revision).toBe(4);
    expect(current.room.config.botCount).toBe(3);
    expect(current.room.participants).toHaveLength(4);
  });

  it("rejects reuse of a command id for different business content", async () => {
    const runtime = createServerRuntime();
    runtime.rooms.create("conflict-room", 4);
    const connection = new FakeConnection({ roomId: "conflict-room" });
    await attachUpgradedConnection(runtime, connection);

    await connection.receive(
      JSON.stringify({
        type: "set_robots",
        count: 1,
        expectedRevision: 0,
        commandId: "robots-command",
      }),
    );
    expect(runtime.rooms.get("conflict-room").revision).toBe(1);
    expect(runtime.rooms.get("conflict-room").room.config.botCount).toBe(1);

    await connection.receive(
      JSON.stringify({
        type: "set_robots",
        count: 2,
        expectedRevision: 1,
        commandId: "robots-command",
      }),
    );

    const current = runtime.rooms.get("conflict-room");
    expect(current.revision).toBe(1);
    expect(current.room.config.botCount).toBe(1);
    expect(JSON.parse(connection.socket.sent.at(-1) ?? "{}")).toMatchObject({
      type: "error",
      code: "command_id_conflict",
    });
  });

  it("rejects a bound socket acting as another player", async () => {
    const runtime = createServerRuntime();
    runtime.rooms.create("identity-room", 4);
    const connection = new FakeConnection({
      roomId: "identity-room",
      playerId: "p1",
    });
    await attachUpgradedConnection(runtime, connection);

    await connection.receive(
      JSON.stringify({
        type: "join_room",
        roomId: "identity-room",
        playerId: "p2",
        name: "玩家2",
        seat: 1,
        expectedRevision: 0,
        commandId: "wrong-player",
      }),
    );

    expect(runtime.rooms.get("identity-room").revision).toBe(0);
    expect(runtime.rooms.get("identity-room").room.participants).toHaveLength(0);
    expect(JSON.parse(connection.socket.sent.at(-1) ?? "{}")).toMatchObject({
      type: "error",
      code: "player_identity_mismatch",
    });

    await connection.receive(
      JSON.stringify({
        type: "join_room",
        roomId: "identity-room",
        playerId: "p1",
        name: "玩家1",
        seat: 0,
        expectedRevision: 0,
        commandId: "right-player",
      }),
    );

    const current = runtime.rooms.get("identity-room");
    expect(current.revision).toBe(1);
    expect(current.room.participants).toHaveLength(1);
    expect(current.room.participants[0]?.id).toBe("p1");
  });
});
