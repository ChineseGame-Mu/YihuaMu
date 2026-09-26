import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const repositoryRoot = resolve(process.cwd(), "..");
const readRepoFile = (path: string): string => readFileSync(resolve(repositoryRoot, path), "utf8");
describe("clean-room Guandan join branding", () => {
  it("keeps the Chinese entry branding and room controls", () => {
    const entry = readRepoFile("frontend/src/CleanroomEntry.tsx");
    expect(entry).toContain("加入牌室");
    expect(entry).toContain("牌室");
    expect(entry).toContain("开始人数");
    expect(entry).toContain("您的姓名");
    expect(entry).toContain("进入牌室");
  });
  it("keeps join styling isolated to the clean-room stylesheet", () => {
    const css = readRepoFile("frontend/src/cleanroom-join.css");
    expect(css).toContain(".cleanroom-join-shell");
    expect(css).toContain(".cleanroom-join-card");
  });
});
