import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const repositoryRoot = resolve(process.cwd(), "..");
const readRepoFile = (path: string): string =>
  readFileSync(resolve(repositoryRoot, path), "utf8");
describe("clean-room approved GuandanTable routing", () => {
  it("keeps the clean-room entry on the approved GuandanTable and compatibility transport", () => {
    const entry = readRepoFile("frontend/src/CleanroomEntry.tsx");
    expect(entry).toContain('import GuandanTable from "./GuandanTable"');
    expect(entry).toContain(
      'import GuandanWebsocketProvider from "./GuandanWebsocketProvider"',
    );
    expect(entry).not.toContain("CleanroomGuandanWebsocketProvider");
    expect(entry).toContain(
      'const cleanroomWebsocket = "wss://chinesegame-yihua.onrender.com/api/guandan"',
    );
    expect(entry).toContain('url.searchParams.set("ws", cleanroomWebsocket)');
  });
  it("routes Guandan through the clean-room compatibility adapter", () => {
    const provider = readRepoFile("frontend/src/GuandanWebsocketProvider.tsx");
    const adapter = readRepoFile("frontend/src/guandanCompatibilityAdapter.ts");
    expect(provider).toContain(
      'const CLEANROOM_WEBSOCKET = "wss://chinesegame-yihua.onrender.com/api/guandan"',
    );
    expect(provider).toContain("adaptGuandanClientMessage");
    expect(adapter).toContain("player_count: playerCount");
  });
});
