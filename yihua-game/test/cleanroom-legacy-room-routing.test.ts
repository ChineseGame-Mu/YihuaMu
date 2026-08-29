import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("clean-room legacy frontend room routing", () => {
  it("carries the real clean-room id through the approved frontend websocket URL", () => {
    const server = readFileSync(
      new URL("../src/node-server.ts", import.meta.url),
      "utf8",
    );

    expect(server).toContain(
      'target.searchParams.set("cleanroomRoom", roomId)',
    );
    expect(server).toContain(
      'target.searchParams.set("ws", cleanroomGuandanWebsocket(roomId))',
    );
    expect(server).toContain("const cleanroomRoom = query.cleanroomRoom?.trim()");
  });

  it("pins legacy join messages to the websocket clean-room context when present", () => {
    const gateway = readFileSync(
      new URL("../src/core/legacy-guandan-gateway.ts", import.meta.url),
      "utf8",
    );

    expect(gateway).toContain(
      "connection.context.roomId === LEGACY_PENDING_ROOM",
    );
    expect(gateway).toContain("? message.room");
    expect(gateway).toContain(": connection.context.roomId");
  });
});
