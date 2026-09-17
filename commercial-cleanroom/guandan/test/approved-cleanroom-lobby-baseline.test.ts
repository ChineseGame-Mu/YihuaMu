import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(process.cwd(), "..");
const entry = (): string =>
  readFileSync(
    resolve(repositoryRoot, "frontend/src/CleanroomEntry.tsx"),
    "utf8",
  );

describe("approved clean-room join-room homepage", () => {
  it("keeps the existing join-room form and supported player counts", () => {
    const source = entry();

    expect(source).toContain("<h2>加入牌室</h2>");
    expect(source).toContain('htmlFor="cleanroom-room"');
    expect(source).toContain('htmlFor="cleanroom-player-count"');
    expect(source).toContain("开始人数：4–14 人");
    expect(source).toContain(
      "const supportedCounts = [4, 6, 8, 10, 12, 14] as const",
    );
    expect(source).toContain('htmlFor="cleanroom-player-name"');
    expect(source).toContain('placeholder="请输入姓名"');
    expect(source).toContain("<span>进入牌室</span>");
    expect(source).toContain("<small>ENTER ROOM</small>");
  });

  it("keeps the join action on the original GuandanTable clean-room chain", () => {
    const source = entry();

    expect(source).toContain('import GuandanTable from "./GuandanTable"');
    expect(source).toContain("if (joined) return <CleanroomTable />;");
    expect(source).toContain("<GuandanTable />");
    expect(source).toContain('url.searchParams.set("cleanroom", "1")');
    expect(source).toContain('url.searchParams.set("game", "guandan")');
    expect(source).toContain('url.searchParams.set("cleanroomRoom", roomId)');
    expect(source).toContain('url.searchParams.set("room", roomId)');
    expect(source).toContain('url.searchParams.set("ws", cleanroomWebsocket)');
  });
});
