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

    expect(source).toContain('className="cleanroom-final-art"');
    expect(source).toContain('aria-label="加入牌室"');
    expect(source).toContain('id="cleanroom-room"');
    expect(source).not.toContain('id="cleanroom-player-count"');
    expect(source).not.toContain("cleanroom-final-no-count-mask");
    expect(source).toContain('import approvedHomepage20261017 from "./guandan-approved-homepage-20261017"');
    expect(source).toContain(
      "const supportedCounts = [4, 6, 8, 10, 12, 14] as const",
    );
    expect(source).toContain('id="cleanroom-player-name"');
    expect(source).toContain('placeholder="请输入姓名"');
    const artworkCss = readFileSync(
      resolve(repositoryRoot, "frontend/src/cleanroom-lobby-artwork.css"),
      "utf8",
    );
    expect(artworkCss).not.toContain(".cleanroom-final-no-count-mask");
    expect(artworkCss).toContain("aspect-ratio:1125/1017");
    const approvedImage = readFileSync(
      resolve(repositoryRoot, "frontend/src/guandan-approved-homepage-20261017.ts"),
      "utf8",
    );
    expect(approvedImage).toContain("data:image/webp;base64,");
    expect(source).toContain("<span>进入牌室</span>");
    expect(source).toContain("<small>ENTER ROOM</small>");
  });

  it("keeps the join action on the original GuandanTable clean-room chain", () => {
    const source = entry();

    expect(source).toContain('import GuandanTable from "./GuandanTable"');
    expect(source).toContain("if (joined) return <CleanroomTable />;");
    expect(source).toContain("<GuandanTable />");
    expect(source).toContain('url.searchParams.set("cleanroom","1")');
    expect(source).toContain('url.searchParams.set("game","guandan")');
    expect(source).toContain('url.searchParams.set("cleanroomRoom",roomId)');
    expect(source).toContain('url.searchParams.set("room",roomId)');
    expect(source).toContain('url.searchParams.set("ws",cleanroomWebsocket)');
  });
});
