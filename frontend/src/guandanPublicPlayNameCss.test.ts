import { readFileSync } from "fs";
import { join } from "path";

describe("public Guandan play player name CSS", () => {
  test("overrides the legacy viewport rule that hides player names", () => {
    const css = readFileSync(
      join(__dirname, "guandan-real-test-20260916.css"),
      "utf8",
    );

    expect(css).toMatch(
      /html body \.guandan-table \.guandan-trick-play > strong\s*\{[^}]*display:\s*block\s*!important;/s,
    );
    expect(css).toMatch(/visibility:\s*visible\s*!important;/);
    expect(css).toMatch(/opacity:\s*1\s*!important;/);
  });
});
