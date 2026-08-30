import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("clean-room backend route precedence", () => {
  it("forces the approved table entry onto card-games-yihua", () => {
    const entry = readFileSync(
      new URL("../../frontend/src/CleanroomEntry.tsx", import.meta.url),
      "utf8",
    );

    expect(entry).toContain(
      'const cleanroomWebsocket = "wss://card-games-yihua.onrender.com/api/guandan"',
    );
    expect(entry).toContain('url.searchParams.set("cleanroom", "1")');
    expect(entry).toContain('url.searchParams.set("ws", cleanroomWebsocket)');
  });

  it("pins clean-room transport to card-games-yihua even when stale overrides exist", () => {
    const transport = readFileSync(
      new URL(
        "../../frontend/src/GuandanWebsocketProvider.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(transport).toContain(
      'const CLEANROOM_WEBSOCKET = "wss://card-games-yihua.onrender.com/api/guandan"',
    );
    expect(transport).toContain('if (query.get("cleanroom") !== "1") return null;');
    expect(transport).toContain("return CLEANROOM_WEBSOCKET;");
    expect(transport).not.toContain(
      'query.get("backend") ?? (window as any)._CLEANROOM_BACKEND',
    );
  });

  it("resolves the clean-room override before any legacy test or production fallback", () => {
    const transport = readFileSync(
      new URL(
        "../../frontend/src/GuandanWebsocketProvider.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    const resolverStart = transport.indexOf(
      "const websocketUri = (): string => {",
    );
    const cleanroomCall = transport.indexOf(
      "const cleanroom = cleanroomWebsocketOverride();",
      resolverStart,
    );
    const cleanroomReturn = transport.indexOf(
      "if (cleanroom !== null) return cleanroom;",
      cleanroomCall,
    );
    const testCall = transport.indexOf(
      "const override = testWebsocketOverride();",
      cleanroomReturn,
    );
    const runtimeFallback = transport.indexOf(
      "const runtimeWebsocketHost = (window as any)._WEBSOCKET_HOST;",
      testCall,
    );
    const vercelFallback = transport.indexOf(
      'if (location.hostname.endsWith(".vercel.app"))',
      runtimeFallback,
    );

    expect(resolverStart).toBeGreaterThanOrEqual(0);
    expect(cleanroomCall).toBeGreaterThan(resolverStart);
    expect(cleanroomReturn).toBeGreaterThan(cleanroomCall);
    expect(testCall).toBeGreaterThan(cleanroomReturn);
    expect(runtimeFallback).toBeGreaterThan(testCall);
    expect(vercelFallback).toBeGreaterThan(runtimeFallback);
  });

  it("keeps the compatibility adapter boundary outside GuandanTable", () => {
    const table = readFileSync(
      new URL("../../frontend/src/GuandanTable.tsx", import.meta.url),
      "utf8",
    );
    const gateway = readFileSync(
      new URL("../src/core/legacy-guandan-gateway.ts", import.meta.url),
      "utf8",
    );

    expect(table).not.toContain("card-games-yihua.onrender.com");
    expect(table).not.toContain("toCleanroomCommand");
    expect(gateway).toContain("toCleanroomCommand");
    expect(gateway).toContain("gameStateToLegacy");
  });
});
