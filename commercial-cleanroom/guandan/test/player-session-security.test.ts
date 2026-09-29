import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { attachLegacyGuandanConnection } from "../src/core/legacy-guandan-gateway.js";
import {
  issuePlayerSessionToken,
  verifyPlayerSessionToken,
} from "../src/core/player-session.js";
import { createServerRuntime } from "../src/core/server-runtime.js";
import type {
  ConnectionContext,
  TextSocket,
} from "../src/core/websocket-service.js";
import type { UpgradedConnection } from "../src/core/websocket-upgrade.js";

class RecordingSocket implements TextSocket {
  readonly sent: Record<string, unknown>[] = [];

  send(text: string): void {
    this.sent.push(JSON.parse(text) as Record<string, unknown>);
  }
}

class FakeConnection implements UpgradedConnection {
  readonly socket = new RecordingSocket();
  private textHandler: ((text: string) => void | Promise<void>) | undefined;
  private closeHandler: (() => void | Promise<void>) | undefined;

  constructor(
    readonly context: ConnectionContext = {
      roomId: "__legacy_guandan_pending__",
    },
  ) {}

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

  latest(type: string): Record<string, any> | undefined {
    return this.socket.sent.filter((message) => message.type === type).at(-1);
  }
}

const originalSecret = process.env.WS_SESSION_SECRET;

beforeEach(() => {
  process.env.WS_SESSION_SECRET =
    "task-one-player-session-test-secret-20260921";
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.WS_SESSION_SECRET;
  else process.env.WS_SESSION_SECRET = originalSecret;
});

describe("signed player sessions", () => {
  it("binds a token to its room, name, player, role, and expiry", () => {
    const now = Date.UTC(2026, 8, 21);
    const token = issuePlayerSessionToken(
      {
        roomId: "0001",
        playerId: "legacy:玩家一",
        name: "玩家一",
        role: "player",
      },
      now,
    );

    expect(
      verifyPlayerSessionToken(token, { roomId: "0001", name: "玩家一" }, now),
    ).toMatchObject({
      roomId: "0001",
      playerId: "legacy:玩家一",
      name: "玩家一",
      role: "player",
    });
    expect(
      verifyPlayerSessionToken(token, { roomId: "0002", name: "玩家一" }, now),
    ).toBeNull();
    expect(
      verifyPlayerSessionToken(token, { roomId: "0001", name: "冒充者" }, now),
    ).toBeNull();
    expect(
      verifyPlayerSessionToken(
        token,
        { roomId: "0001", name: "玩家一" },
        now + 12 * 60 * 60 * 1000,
      ),
    ).toBeNull();
    expect(
      verifyPlayerSessionToken(
        `${token.startsWith("e") ? "f" : "e"}${token.slice(1)}`,
        { roomId: "0001", name: "玩家一" },
        now,
      ),
    ).toBeNull();
  });

  it("rejects same-name takeover and restores the private hand with a valid token", async () => {
    const runtime = createServerRuntime();
    const original = new FakeConnection();
    await attachLegacyGuandanConnection(runtime, original);
    await original.receive({
      type: "join",
      room: "secure-room",
      name: "玩家一",
      player_count: 4,
    });
    const identity = original.latest("joined");
    expect(identity?.player_id).toBe("legacy:玩家一");
    expect(identity?.resume_token).toEqual(expect.any(String));

    for (let seat = 1; seat < 4; seat += 1) {
      const teammate = new FakeConnection();
      await attachLegacyGuandanConnection(runtime, teammate);
      await teammate.receive({
        type: "join",
        room: "secure-room",
        name: `玩家${seat + 1}`,
        player_count: 4,
        desired_seat: seat,
      });
    }
    await original.receive({ type: "start", player_count: 4 });
    expect(original.latest("hand")?.cards).toHaveLength(27);
    await original.close();

    const attacker = new FakeConnection();
    await attachLegacyGuandanConnection(runtime, attacker);
    await attacker.receive({
      type: "join",
      room: "secure-room",
      name: "玩家一",
      player_count: 4,
    });
    expect(attacker.socket.sent).toContainEqual({
      type: "error",
      message: expect.stringMatching(/resume token/i),
    });
    expect(attacker.latest("hand")).toBeUndefined();

    const reconnect = new FakeConnection();
    await attachLegacyGuandanConnection(runtime, reconnect);
    await reconnect.receive({
      type: "join",
      room: "secure-room",
      name: "玩家一",
      player_count: 4,
      player_id: identity?.player_id,
      resume_token: identity?.resume_token,
    });
    expect(reconnect.latest("error")).toBeUndefined();
    expect(reconnect.latest("joined")).toMatchObject({
      room: "secure-room",
      seat: 0,
      player_id: "legacy:玩家一",
    });
    expect(reconnect.latest("hand")?.cards).toHaveLength(27);
  });
});
