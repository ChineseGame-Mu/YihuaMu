import { readFileSync } from "fs";
import { join } from "path";

describe("Guandan tribute action visibility", () => {
  const table = readFileSync(join(__dirname, "GuandanTable.tsx"), "utf8");
  const controls = readFileSync(
    join(__dirname, "GuandanCustomSortControls.tsx"),
    "utf8",
  );

  test("shows the required exchange action and hides ordinary play during tribute", () => {
    expect(table).toContain('className="guandan-tribute-action"');
    expect(table).toContain('sendSingleSelected("tribute_card")');
    expect(table).toContain('sendSingleSelected("return_tribute")');
    expect(table).toMatch(/!tributePending\s*&&\s*\(/);
    expect(table).toContain('className="guandan-play-action"');
    expect(table).toContain('className="guandan-pass-action"');
  });

  test("gives the exchange action its own full-width, non-overlapping slot", () => {
    expect(controls).toMatch(
      />\.guandan-tribute-action,[\s\S]*?>\.guandan-tribute-waiting\{[\s\S]*?left:14px!important;right:14px!important;width:auto!important/,
    );
    expect(controls).not.toContain("button:nth-last-of-type");
  });
});
