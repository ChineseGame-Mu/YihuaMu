import { readFileSync } from "fs";
import { join } from "path";

describe("Guandan enlarged player displays", () => {
  const css = readFileSync(
    join(__dirname, "guandan-player-display-scale.css"),
    "utf8",
  );
  const table = readFileSync(join(__dirname, "GuandanTable.tsx"), "utf8");
  const layout = readFileSync(
    join(__dirname, "guandan-approved-layout.css"),
    "utf8",
  );

  test("gives the public table five eighths and my table three eighths", () => {
    expect(layout).toMatch(
      /grid-template-rows:\s*auto\s+minmax\(0,\s*5fr\)\s+minmax\(0,\s*3fr\)\s*!important/,
    );
  });

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

  test("doubles the current-turn display and embeds left, observe, right controls", () => {
    expect(css).toMatch(/min-width:\s*300px\s*!important/);
    expect(css).toMatch(/font-size:\s*28px\s*!important/);
    expect(css).toMatch(/right:\s*14px\s*!important/);
    expect(css).toMatch(/left:\s*auto\s*!important/);
    expect(css).toMatch(/bottom:\s*14px\s*!important/);
    expect(table).toContain("`${player}向左换位`");
    expect(table).toContain("`${player}切换参与或旁观`");
    expect(table).toContain("`${player}向右换位`");
    expect(table).toContain('type: "move_seat"');
    expect(table).toContain('type: "set_participation"');
    expect(css).toMatch(
      /\.guandan-public-card-back\s*\{[\s\S]*?position:\s*relative\s*!important/,
    );
    expect(css).toMatch(
      /\.guandan-public-seat-move-controls\s*\{[\s\S]*?position:\s*absolute\s*!important[\s\S]*?bottom:\s*0\s*!important/,
    );
    expect(css).toMatch(/width:\s*32px\s*!important/);
  });
});
