import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderJoinPage } from "../src/core/join-page.js";

describe("approved Guandan frontend clean-room bridge", () => {
  it("keeps the clean-room entry page as the approved join-room screen", () => {
    const html = renderJoinPage("manual-test");
    expect(html).toContain('<h1 class="join-title">加入牌室</h1>');
    expect(html).toContain("开始人数：4–14 人");
    expect(html).toContain("您的姓名");
    expect(html).toContain("进入牌室");
  });

  it("mounts the approved Guandan frontend stack without replacing GuandanTable", () => {
    const entry = readFileSync(
      new URL("../../frontend/src/CleanroomEntry.tsx", import.meta.url),
      "utf8",
    );
    const table = readFileSync(
      new URL("../../frontend/src/GuandanTable.tsx", import.meta.url),
      "utf8",
    );
    const transport = readFileSync(
      new URL("../../frontend/src/GuandanWebsocketProvider.tsx", import.meta.url),
      "utf8",
    );
    const adapter = readFileSync(
      new URL("../../frontend/src/guandanCompatibilityAdapter.ts", import.meta.url),
      "utf8",
    );
    expect(entry).toContain('import GuandanTable from "./GuandanTable"');
    expect(entry).toContain(
      'import GuandanWebsocketProvider from "./GuandanWebsocketProvider"',
    );
    expect(entry).toContain("<GuandanWebsocketProvider>");
    expect(entry).toContain("<GuandanStateProvider>");
    expect(entry).toContain("<GuandanTable />");
    expect(transport).toContain("adaptGuandanClientMessage");
    expect(transport).toContain("return CLEANROOM_WEBSOCKET;");
    expect(adapter).toContain("player_count: playerCount");
    expect(table).not.toContain("CleanroomGuandanWebsocketProvider");
    expect(table).toContain(
      "const GuandanTable: React.FunctionComponent = () =>",
    );
  });

  it("locks the approved frontend to the authorized three-game Render backend", () => {
    const entry = readFileSync(
      new URL("../../frontend/src/CleanroomEntry.tsx", import.meta.url),
      "utf8",
    );
    const transport = readFileSync(
      new URL("../../frontend/src/GuandanWebsocketProvider.tsx", import.meta.url),
      "utf8",
    );
    const allowed = "wss://chinesegame-yihua.onrender.com/api/guandan";
    expect(entry).toContain(`const cleanroomWebsocket = "${allowed}"`);
    expect(entry).toContain('url.searchParams.set("cleanroom", "1")');
    expect(entry).toContain('url.searchParams.set("ws", cleanroomWebsocket)');
    expect(transport).toContain(`const CLEANROOM_WEBSOCKET = "${allowed}"`);
    expect(transport).toContain(
      'if (query.get("cleanroom") !== "1") return CLEANROOM_WEBSOCKET',
    );
    expect(transport).toContain("return CLEANROOM_WEBSOCKET;");
    expect(entry).not.toContain("card-games-yihua.onrender.com");
    expect(transport).not.toContain("card-games-yihua.onrender.com");
    expect(entry).not.toContain("yihua-mu.vercel.app");
    expect(transport).not.toContain(".vercel.app");
  });

  it("preserves the visible clean-room room id at the compatibility boundary", () => {
    const entry = readFileSync(
      new URL("../../frontend/src/CleanroomEntry.tsx", import.meta.url),
      "utf8",
    );
    const transport = readFileSync(
      new URL("../../frontend/src/GuandanWebsocketProvider.tsx", import.meta.url),
      "utf8",
    );
    const adapter = readFileSync(
      new URL("../../frontend/src/guandanCompatibilityAdapter.ts", import.meta.url),
      "utf8",
    );
    expect(entry).toContain('url.searchParams.set("cleanroomRoom", roomId)');
    expect(entry).toContain('url.searchParams.set("room", roomId)');
    expect(transport).toContain('room: query.get("cleanroomRoom")');
    expect(adapter).toContain("const room = options.room?.trim()");
    expect(adapter).toContain("room: room || message.room");
  });

  it("makes the clean-room branch root enter through CleanroomEntry", () => {
    const index = readFileSync(
      new URL("../../frontend/src/index.tsx", import.meta.url),
      "utf8",
    );
    expect(index).toContain('import CleanroomEntry from "./CleanroomEntry"');
    expect(index).toContain('(game === null && params.get("classic") !== "1")');
    expect(index).toContain("<CleanroomEntry />");
  });

  it("keeps the compatibility boundary on the backend legacy gateway", () => {
    const gateway = readFileSync(
      new URL("../src/core/legacy-guandan-gateway.ts", import.meta.url),
      "utf8",
    );
    expect(gateway).toContain("toCleanroomCommand");
    expect(gateway).toContain("gameStateToLegacy");
    expect(gateway).toContain("requestedPlayerCount");
    expect(gateway).toContain(
      "runtime.rooms.create(roomId, supportedPlayerCount",
    );
  });
});
