import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(process.cwd(), "..");
const readRepoFile = (path: string): string =>
  readFileSync(resolve(repositoryRoot, path), "utf8");

describe("clean-room approved GuandanTable routing", () => {
  it("keeps the clean-room entry on the approved GuandanTable and legacy compatibility transport", () => {
    const entry = readRepoFile("frontend/src/CleanroomEntry.tsx");

    expect(entry).toContain('import GuandanTable from "./GuandanTable"');
    expect(entry).toContain(
      'import GuandanWebsocketProvider from "./GuandanWebsocketProvider"',
    );
    expect(entry).not.toContain("CleanroomGuandanWebsocketProvider");
    expect(entry).toContain(
      'const cleanroomWebsocket = "wss://card-games-yihua.onrender.com/api/guandan"',
    );
    expect(entry).toContain('url.searchParams.set("ws", cleanroomWebsocket)');
  });

  it("routes the Vercel Guandan alias through the clean-room compatibility adapter", () => {
    const config = JSON.parse(readRepoFile("frontend/vercel.json")) as {
      redirects: Array<{ source: string; destination: string }>;
    };
    const guandan = config.redirects.find(({ source }) => source === "/guandan");

    expect(guandan).toBeDefined();
    expect(guandan?.destination).toContain(
      "card-games-yihua.onrender.com%2Fapi%2Fguandan",
    );
    expect(guandan?.destination).not.toContain("%2Fws%2Frooms%2F");
    expect(guandan?.destination).not.toContain("chinesegame-yihua.onrender.com");
  });
});
