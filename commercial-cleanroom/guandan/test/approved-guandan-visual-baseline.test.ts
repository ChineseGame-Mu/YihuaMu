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
      "f4b87682dbbf4ee008c87acac154991ddc7e6fe8",
    );
  });

  it("keeps the accepted core Guandan styling byte-for-byte unchanged", () => {
    expect(gitBlobSha("../../frontend/src/guandan.css")).toBe(
      "bf3de0e71c1021139ae587b74d45d8d575e72e9b",
    );
    expect(gitBlobSha("../../frontend/src/guandan-approved-layout.css")).toBe(
      "b307dfaf56e02546a681eaa49336528073af5acb",
    );
  });
});
