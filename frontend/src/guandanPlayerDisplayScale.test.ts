import { readFileSync } from "fs";
import { join } from "path";

describe("Guandan enlarged player displays", () => {
  const css = readFileSync(
    join(__dirname, "guandan-player-display-scale.css"),
    "utf8",
  );
  const table = readFileSync(join(__dirname, "GuandanTable.tsx"), "utf8");
  const positions = readFileSync(
    join(__dirname, "guandan-public-player-position.css"),
    "utf8",
  );
  const layout = readFileSync(
    join(__dirname, "guandan-approved-layout.css"),
    "utf8",
  );

  test("gives the public table five eighths and my table three eighths", () => {
    expect(layout).toMatch(
      /grid-template-rows:\s*auto\s+minmax\(0,\s*5fr\)\s+minmax\(0,\s*3fr\)\s*!important/,
    );
  });

  test("shrinks the review panel by twenty percent and extends both tables", () => {
    expect(layout).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*4fr\)\s+minmax\(224px,\s*1fr\)\s*!important/,
    );
    expect(layout).toMatch(
      /@media \(max-width:\s*760px\)[\s\S]*?grid-template-columns:\s*minmax\(0,\s*4fr\)\s+minmax\(144px,\s*1fr\)\s*!important/,
    );
  });

  test("keeps wide public player displays, reduces their height by thirty percent, and shows names", () => {
    expect(css).toMatch(/gap:\s*0\s*!important/);
    expect(css).toMatch(/flex:\s*0 0 96px\s*!important/);
    expect(css).toMatch(
      /\.guandan-public-card-back[\s\S]*?width:\s*96px\s*!important/,
    );
    expect(css).toMatch(
      /\.guandan-public-card-back[\s\S]*?margin:\s*0\s*!important/,
    );
    expect(css).toMatch(/height:\s*67\.2px\s*!important/);
    expect(table).toContain('className="guandan-public-card-player-name"');
    expect(table).toContain("{player}");
    expect(table).not.toContain("<span>掼蛋</span>");
  });

  test("reserves space so enlarged displays cannot cover played cards", () => {
    expect(css).toMatch(
      /\.guandan-table-stage\s*\{[\s\S]*?padding-top:\s*125\.2px\s*!important/,
    );
  });

  test("places four players on opposite table edges and centers every played-card group", () => {
    expect(positions).toMatch(
      /data-guandan-player-count="4"[\s\S]*?nth-child\(1\)[\s\S]*?top:\s*34px[\s\S]*?left:\s*50%/,
    );
    expect(positions).toMatch(
      /data-guandan-player-count="4"[\s\S]*?nth-child\(2\)[\s\S]*?top:\s*50%[\s\S]*?left:\s*10px/,
    );
    expect(positions).toMatch(
      /data-guandan-player-count="4"[\s\S]*?nth-child\(3\)[\s\S]*?bottom:\s*8px[\s\S]*?left:\s*50%/,
    );
    expect(positions).toMatch(
      /data-guandan-player-count="4"[\s\S]*?nth-child\(4\)[\s\S]*?top:\s*50%[\s\S]*?right:\s*10px/,
    );
    expect(positions).toMatch(
      /data-guandan-player-count="4"[\s\S]*?\.guandan-table-stage\s*\{[\s\S]*?align-items:\s*center[\s\S]*?justify-content:\s*center/,
    );
    expect(positions).toMatch(
      /data-guandan-player-count="4"[\s\S]*?\.guandan-trick-plays\s*\{[\s\S]*?justify-content:\s*center/,
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
