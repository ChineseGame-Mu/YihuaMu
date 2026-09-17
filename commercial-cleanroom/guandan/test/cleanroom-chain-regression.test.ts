import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("approved clean-room end-to-end chain regression", () => {
  it("keeps join page -> original GuandanTable -> compatibility adapter -> card-games-yihua", () => {
    const entry = read("../../frontend/src/CleanroomEntry.tsx");
    const table = read("../../frontend/src/GuandanTable.tsx");
    const transport = read("../../frontend/src/GuandanWebsocketProvider.tsx");
    const adapter = read("../../frontend/src/guandanCompatibilityAdapter.ts");
    const gateway = read("../src/core/legacy-guandan-gateway.ts");

    expect(entry).toContain('import GuandanTable from "./GuandanTable"');
    expect(entry).toContain("<GuandanTable />");
    expect(entry).toContain(
      'const cleanroomWebsocket = "wss://card-games-yihua.onrender.com/api/guandan"',
    );
    expect(entry).toContain('url.searchParams.set("cleanroom", "1")');
    expect(entry).toContain('url.searchParams.set("ws", cleanroomWebsocket)');

    expect(table).not.toContain("CleanroomGuandanWebsocketProvider");
    expect(transport).toContain(
      'const CLEANROOM_WEBSOCKET = "wss://card-games-yihua.onrender.com/api/guandan"',
    );
    expect(transport).toContain("return CLEANROOM_WEBSOCKET;");
    expect(transport).toContain("adaptGuandanClientMessage");
    expect(adapter).toContain("const room = options.room?.trim()");
    expect(adapter).toContain("room: room || message.room");
    expect(adapter).toContain("player_count: playerCount");

    expect(gateway).toContain("toCleanroomCommand");
    expect(gateway).toContain("gameStateToLegacy");
    expect(gateway).toContain("requestedPlayerCount");
    expect(gateway).toContain(
      "runtime.rooms.create(roomId, supportedPlayerCount",
    );
  });

  it("does not allow the clean-room entry or transport to point at the old production backend", () => {
    const entry = read("../../frontend/src/CleanroomEntry.tsx");
    const transport = read("../../frontend/src/GuandanWebsocketProvider.tsx");
    expect(entry).not.toContain("chinesegame-yihua.onrender.com");
    expect(entry).toContain("card-games-yihua.onrender.com");
    expect(transport).toContain("return CLEANROOM_WEBSOCKET;");
    expect(transport).not.toContain(
      'query.get("backend") ?? (window as any)._CLEANROOM_BACKEND',
    );
  });
});
