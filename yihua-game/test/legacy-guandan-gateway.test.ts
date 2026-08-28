import { describe, expect, it } from "vitest";

import { attachLegacyGuandanConnection } from "../src/core/legacy-guandan-gateway.js";
import { createServerRuntime } from "../src/core/server-runtime.js";
import type { TextSocket } from "../src/core/websocket-service.js";
import type { UpgradedConnection } from "../src/core/websocket-upgrade.js";

class MemorySocket implements TextSocket {
  readonly sent: string[] = [];

  send(text: string): void {
    this.sent.push(text);
  }

  messages(): Array<Record<string, unknown>> {
    return this.sent.map((text) => JSON.parse(text) as Record<string, unknown>);
  }
}

class MemoryConnection implements UpgradedConnection {
  readonly socket = new MemorySocket();
  readonly context = { roomId: "legacy-unbound" };
  private textHandler: ((text: string) => void | Promise<void>) | undefined;
  private closeHandler: (() => void | Promise<void>) | undefined;

  onText(handler: (text: string) => void | Promise<void>): void {
    this.textHandler = handler;
  }

  onClose(handler: () => void | Promise<void>): void {
    this.closeHandler = handler;
  }

  async receive(message: unknown): Promise<void> {
    if (this.textHandler === undefined) throw new Error("text handler is missing");
    await this.textHandler(JSON.stringify(message));
  }

  async close(): Promise<void> {
    await this.closeHandler?.();
  }
}

const connectLegacyPlayer = async (
  runtime: ReturnType<typeof createServerRuntime>,
  room: string,
  name: string,
): Promise<MemoryConnection> => {
  const connection = new MemoryConnection();
  await attachLegacyGuandanConnection(runtime, connection);
  await connection.receive({ type: "join", room, name });
  return connection;
};

describe("clean-room /api/guandan compatibility gateway", () => {
  it("runs four human players through join, start, private hand, and public state", async () => {
    const runtime = createServerRuntime();
    const players = await Promise.all(
      ["玩家1", "玩家2", "玩家3", "玩家4"].map((name) =>
        connectLegacyPlayer(runtime, "gateway-4p", name),
      ),
    );

    const managedBeforeStart = runtime.rooms.get("gateway-4p");
    expect(managedBeforeStart.room.participants).toHaveLength(4);
    expect(managedBeforeStart.room.participants.every(({ kind }) => kind === "human")).toBe(true);

    await players[0]!.receive({ type: "start", player_count: 4 });

    for (const player of players) {
      const messages = player.socket.messages();
      expect(messages.some(({ type }) => type === "connected")).toBe(true);
      expect(messages.some(({ type }) => type === "joined")).toBe(true);
      expect(messages.some(({ type }) => type === "started")).toBe(true);
      expect(messages.some(({ type }) => type === "hand")).toBe(true);
      expect(messages.some(({ type }) => type === "state")).toBe(true);
    }

    const managedAfterStart = runtime.rooms.get("gateway-4p");
    expect(managedAfterStart.game.config.playerCount).toBe(4);
    expect(managedAfterStart.game.hands).toHaveLength(4);
    expect(managedAfterStart.game.hands.every((hand) => hand.length === 27)).toBe(true);
  });

  it("reconnects the same legacy player without allocating a duplicate seat", async () => {
    const runtime = createServerRuntime();
    const first = await connectLegacyPlayer(runtime, "gateway-reconnect", "玩家1");
    await connectLegacyPlayer(runtime, "gateway-reconnect", "玩家2");
    await connectLegacyPlayer(runtime, "gateway-reconnect", "玩家3");
    await connectLegacyPlayer(runtime, "gateway-reconnect", "玩家4");

    await first.close();
    expect(
      runtime.rooms.get("gateway-reconnect").room.participants.find(({ name }) => name === "玩家1")
        ?.connected,
    ).toBe(false);

    const reconnected = await connectLegacyPlayer(runtime, "gateway-reconnect", "玩家1");
    const managed = runtime.rooms.get("gateway-reconnect");
    const sameName = managed.room.participants.filter(({ name }) => name === "玩家1");

    expect(managed.room.participants).toHaveLength(4);
    expect(sameName).toHaveLength(1);
    expect(sameName[0]?.seat).toBe(0);
    expect(sameName[0]?.connected).toBe(true);
    expect(
      reconnected.socket
        .messages()
        .some(({ type, seat }) => type === "joined" && seat === 0),
    ).toBe(true);
  });
});
