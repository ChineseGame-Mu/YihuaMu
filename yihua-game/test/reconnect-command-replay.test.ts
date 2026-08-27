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
    expect(runtime.rooms.get("replay-room").room.participants[0]?.connected).toBe(
      false,
    );

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
});
