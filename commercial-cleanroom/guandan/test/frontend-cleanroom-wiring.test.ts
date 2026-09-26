import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), "..", relativePath), "utf8");

describe("clean-room frontend wiring", () => {
  it("keeps the clean-room entry as the commercial default root", () => {
    const index = source("frontend/src/index.tsx");
    expect(index).toContain('params.get("cleanroom") === "1"');
    expect(index).toContain('params.get("classic") !== "1"');
    expect(index).toContain("<CleanroomEntry />");
  });

  it("renders the original GuandanTable through the clean-room provider", () => {
    const entry = source("frontend/src/CleanroomEntry.tsx");

    expect(entry).toContain('import GuandanTable from "./GuandanTable"');
    expect(entry).toContain("<GuandanWebsocketProvider>");
    expect(entry).toContain("<GuandanTable />");
  });

  it("forces clean-room browser traffic to card-games-yihua before legacy fallbacks", () => {
    const provider = source("frontend/src/GuandanWebsocketProvider.tsx");

    expect(provider).toContain(
      'const CLEANROOM_WEBSOCKET = "wss://chinesegame-yihua.onrender.com/api/guandan"',
    );
    expect(provider).toContain('query.get("cleanroom") !== "1"');

    expect(provider).toContain("const websocketUri = (): string =>");
    expect(provider).not.toContain("_WEBSOCKET_HOST");
  });

  it("routes legacy Guandan join messages through the compatibility adapter", () => {
    const provider = source("frontend/src/GuandanWebsocketProvider.tsx");
    const adapter = source("frontend/src/guandanCompatibilityAdapter.ts");

    expect(provider).toContain("adaptGuandanClientMessage(message, {");
    expect(provider).toContain("cleanroom: true");
    expect(provider).toContain('room: query.get("cleanroomRoom")');
    expect(provider).toContain("playerCount: Number.isFinite(playerCount)");

    expect(adapter).toContain(
      'if (!options.cleanroom || message.type !== "join") return message;',
    );
    expect(adapter).toContain(
      "const supportedPlayerCounts = [4, 6, 8, 10, 12, 14]",
    );
    expect(adapter).toContain("player_count: playerCount");
  });
});
