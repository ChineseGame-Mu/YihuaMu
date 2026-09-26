import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gitBlobSha = (path: string): string => {
  const content = readFileSync(new URL(path, import.meta.url));
  const header = Buffer.from(`blob ${content.length}\0`, "utf8");
  return createHash("sha1").update(header).update(content).digest("hex");
};

describe("approved Guandan visual baseline", () => {
  it("keeps the accepted GuandanTable implementation byte-for-byte unchanged", () => {
    expect(gitBlobSha("../../frontend/src/GuandanTable.tsx")).toBe(
      "f36065dc118eaddbf60ec604eaab1477e6adc83c",
    );
  });

  it("keeps the accepted core Guandan styling byte-for-byte unchanged", () => {
    expect(gitBlobSha("../../frontend/src/guandan.css")).toBe(
      "cffdc1716a24aae19e952c820c3f84c08b39cb70",
    );
    expect(gitBlobSha("../../frontend/src/guandan-approved-layout.css")).toBe(
      "cfc188167de187b6b93db25cd2d874e448291c83",
    );
  });
});
