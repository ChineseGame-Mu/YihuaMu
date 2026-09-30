import { readFileSync } from "fs";
import { join } from "path";

describe("Guandan public-table ceremonies", () => {
  const table = readFileSync(join(__dirname, "GuandanTable.tsx"), "utf8");
  const css = readFileSync(
    join(__dirname, "guandan-table-ceremony.css"),
    "utf8",
  );

  test("shows the live deal and remaining card count in the table center", () => {
    expect(table).toContain('className="guandan-deal-ceremony"');
    expect(table).toContain("dealPresentation.remainingCards");
    expect(table).toContain("正在发给");
    expect(css).toContain("@keyframes guandan-real-deal-flight");
  });

  test("shows both tribute and return-tribute movement on the public table", () => {
    expect(table).toContain("公共桌面进贡过程");
    expect(table).toContain("公共桌面还贡过程");
    expect(table).toContain("state.tributeCards.map");
    expect(table).toContain("state.returnTributeCards.map");
    expect(table).toContain("进贡 →");
    expect(table).toContain("还贡 →");
  });
});
