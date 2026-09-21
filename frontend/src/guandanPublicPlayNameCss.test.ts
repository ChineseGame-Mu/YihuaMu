import { readFileSync } from "fs";
import { join } from "path";

describe("public Guandan play player name CSS", () => {
  const css = readFileSync(
    join(__dirname, "guandan-real-test-20260916.css"),
    "utf8",
  );

  test("overrides the legacy viewport rule that hides player names", () => {
    expect(css).toMatch(
      /html body \.guandan-table \.guandan-trick-play > strong\s*\{[^}]*display:\s*block\s*!important;/,
    );
    expect(css).toMatch(/visibility:\s*visible\s*!important;/);
    expect(css).toMatch(/opacity:\s*1\s*!important;/);
  });

  test("uses distinct high-contrast name colors for the two teams", () => {
    expect(css).toMatch(
      /\.guandan-trick-play\.guandan-public-team-a[\s\S]*?> strong\s*\{[^}]*background:\s*#f4a6c1\s*!important;[^}]*color:\s*#301024\s*!important;/,
    );
    expect(css).toMatch(
      /\.guandan-trick-play\.guandan-public-team-b[\s\S]*?> strong\s*\{[^}]*background:\s*#5156d9\s*!important;[^}]*color:\s*#ffffff\s*!important;/,
    );
  });

  test("assigns public play labels by seat parity so teammates share a color", () => {
    const table = readFileSync(join(__dirname, "GuandanTable.tsx"), "utf8");

    expect(table).toContain('play.player % 2 === 0 ? "a" : "b"');
  });
});
