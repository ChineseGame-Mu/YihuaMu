import { readFileSync } from "fs";
import { join } from "path";

describe("Guandan enlarged player displays", () => {
  const css = readFileSync(
    join(__dirname, "guandan-player-display-scale.css"),
    "utf8",
  );
  const table = readFileSync(join(__dirname, "GuandanTable.tsx"), "utf8");

  test("doubles public player displays with no gap", () => {
    expect(css).toMatch(/gap:\s*0\s*!important/);
    expect(css).toMatch(/flex:\s*0 0 96px\s*!important/);
    expect(css).toMatch(
      /\.guandan-public-card-back[\s\S]*?width:\s*96px\s*!important/,
    );
    expect(css).toMatch(
      /\.guandan-public-card-back[\s\S]*?margin:\s*0\s*!important/,
    );
    expect(css).toMatch(/height:\s*96px\s*!important/);
  });

  test("reserves space so enlarged displays cannot cover played cards", () => {
    expect(css).toMatch(
      /\.guandan-table-stage\s*\{[\s\S]*?padding-top:\s*154px\s*!important/,
    );
  });

  test("doubles the current-turn display and provides both seat arrows", () => {
    expect(css).toMatch(/min-width:\s*300px\s*!important/);
    expect(css).toMatch(/font-size:\s*28px\s*!important/);
    expect(css).toMatch(/right:\s*14px\s*!important/);
    expect(css).toMatch(/left:\s*auto\s*!important/);
    expect(css).toMatch(/bottom:\s*14px\s*!important/);
    expect(table).toContain('aria-label="向左换位"');
    expect(table).toContain('aria-label="向右换位"');
    expect(table).toContain('type: "move_seat"');
  });
});
