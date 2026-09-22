import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const gitBlobSha = (relativeUrl: string): string =>
  execFileSync(
    "git",
    ["hash-object", fileURLToPath(new URL(relativeUrl, import.meta.url))],
    { encoding: "utf8" },
  ).trim();

describe("approved Guandan frontend visual baseline", () => {
  it("keeps the accepted GuandanTable source byte-for-byte unchanged", () => {
    expect(gitBlobSha("../../frontend/src/GuandanTable.tsx")).toBe(
      "958cb1364c27dc9cc8616f8382445c09cc4f5721",
    );
  });

  it("keeps the accepted playing-card renderer byte-for-byte unchanged", () => {
    expect(gitBlobSha("../../frontend/src/SvgCard.tsx")).toBe(
      "5616d8bb21f8b9529c1d78de43f426ff399a4a62",
    );
  });
});
