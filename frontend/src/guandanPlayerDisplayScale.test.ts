import { readFileSync } from "fs";
import { createHash } from "crypto";
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
    expect(table).not.toContain('className="guandan-public-player-seat"');
    expect(table).not.toContain("<strong title={player}>{player}</strong>");
  });

  test("reserves space so enlarged displays cannot cover played cards", () => {
    expect(css).toMatch(
      /\.guandan-table-stage\s*\{[\s\S]*?padding-top:\s*125\.2px\s*!important/,
    );
  });

  test("keeps local player at bottom, partner opposite, opponents at sides, and plays centered", () => {
    // Server seat IDs must not be rewritten when the viewer's seat changes.
    expect(table).toContain("guandan-relative-${(index - state.seat + 4) % 4}");

    // Relative 0=self, 2=partner, 1/3=opponents.
    expect(positions).toMatch(
      /\.guandan-public-player-back\.guandan-relative-0\s*\{[\s\S]*?bottom:\s*8px[\s\S]*?left:\s*50%/,
    );
    expect(positions).toMatch(
      /\.guandan-public-player-back\.guandan-relative-1\s*\{[\s\S]*?top:\s*50%[\s\S]*?right:\s*10px/,
    );
    expect(positions).toMatch(
      /\.guandan-public-player-back\.guandan-relative-2\s*\{[\s\S]*?top:\s*var\(--guandan-top-seat-offset,\s*0px\)[\s\S]*?left:\s*50%/,
    );
    expect(positions).toMatch(
      /\.guandan-public-player-back\.guandan-relative-3\s*\{[\s\S]*?top:\s*50%[\s\S]*?left:\s*10px/,
    );
    expect(positions).toMatch(
      /data-guandan-player-count="4"[\s\S]*?\.guandan-table-stage\s*\{[\s\S]*?align-items:\s*center[\s\S]*?justify-content:\s*center/,
    );
    expect(positions).toMatch(
      /data-guandan-player-count="4"[\s\S]*?\.guandan-trick-plays\s*\{[\s\S]*?justify-content:\s*center/,
    );
  });

  test("moves the top seat below every visible ceremony panel", () => {
    expect(table).toContain('".guandan-initial-draw-mini"');
    expect(table).toContain('".guandan-start-panel"');
    expect(table).toContain('".guandan-next-round-panel"');
    expect(table).toContain('".guandan-tribute-panel"');
    expect(table).toContain('".guandan-notice-panel"');
    expect(table).toContain("new ResizeObserver(scheduleUpdate)");
    expect(table).toContain("new MutationObserver(() => {");
    expect(table).toContain('"--guandan-top-seat-offset"');
    expect(positions).toContain("var(--guandan-top-seat-offset, 0px)");
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

  test("pins the user-approved October 17 homepage image and layout without freezing game logic", () => {
    const entry = readFileSync(join(__dirname, "CleanroomEntry.tsx"), "utf8");
    expect(entry).toContain('from "./guandan-approved-homepage-20261017"');
    expect(entry).not.toContain('from "./cleanroom-lobby-final-image"');
    expect(entry).not.toContain('className="cleanroom-final-no-count-mask"');
    expect(entry).not.toContain('id="cleanroom-player-count"');
    const approvedFiles = [
      [
        "guandan-approved-homepage-20261017.ts",
        "bb2562d4c92f43dbd16df886f3bc3dd84266c3c3",
      ],
      [
        "cleanroom-lobby-artwork.css",
        "776071e50dc48e037f4a9b410251d6f290312852",
      ],
    ] as const;
    for (const [filename, approvedGitBlobSha] of approvedFiles) {
      const bytes = readFileSync(join(__dirname, filename));
      const gitBlobSha = createHash("sha1")
        .update(`blob ${bytes.length}\0`)
        .update(bytes)
        .digest("hex");
      expect(gitBlobSha).toBe(approvedGitBlobSha);
    }
  });
});
