import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(process.cwd(), "..");
const readRepoFile = (path: string): string =>
  readFileSync(resolve(repositoryRoot, path), "utf8");

describe("clean-room Guandan join branding", () => {
  it("keeps the approved bilingual Chinese entry branding and room controls", () => {
    const entry = readRepoFile("frontend/src/CleanroomEntry.tsx");

    expect(entry).toContain("掼蛋游戏");
    expect(entry).toContain("GUANDAN GAME");
    expect(entry).toContain("经典掼蛋 · 智慧对决 · 乐在其中");
    expect(entry).toContain("cleanroom-emblem");
    expect(entry).toContain('id="cleanroom-player-count"');
    expect(entry).toContain('id="cleanroom-player-name"');
    expect(entry).toContain("进入牌室");
    expect(entry).toContain("ENTER ROOM");
  });

  it("keeps the Chinese decorative theme isolated to the clean-room join stylesheet", () => {
    const css = readRepoFile("frontend/src/cleanroom-join.css");

    expect(css).toContain(".cleanroom-emblem");
    expect(css).toContain(".cleanroom-bamboo");
    expect(css).toContain(".cleanroom-plum");
    expect(css).toContain(".cleanroom-lantern");
    expect(css).toContain(".cleanroom-mountains");
    expect(css).toContain(".cleanroom-waves");
  });
});
