import { readFileSync } from "fs";
import { join } from "path";

describe("Guandan automatic layout options", () => {
  const table = readFileSync(join(__dirname, "GuandanTable.tsx"), "utf8");
  const css = readFileSync(
    join(__dirname, "guandan-auto-layout-options.css"),
    "utf8",
  );

  test("offers three automatic grouping plans and horizontal or vertical layout", () => {
    expect(table).toContain('id="guandan-auto-arrange-strategy"');
    expect(table).toContain("智能综合");
    expect(table).toContain("顺子／同花顺优先");
    expect(table).toContain("对子／三张／钢板优先");
    expect(table).toContain('id="guandan-auto-hand-layout"');
    expect(table).toContain('value="horizontal"');
    expect(table).toContain('value="vertical"');
    expect(css).toContain(".guandan-auto-layout-vertical");
    expect(css).toContain("flex-direction: column");
    expect(css).toContain("overflow-y: auto !important");
  });

  test("supports manual group editing and one-click play", () => {
    expect(table).toContain('aria-label="自动理牌手动调整"');
    expect(table).toContain("moveActiveAutoGroup");
    expect(table).toContain("splitActiveAutoGroup");
    expect(table).toContain("makeSelectedCustomGroup");
    expect(table).toContain("恢复方案");
    expect(table).toContain("一键出此组");
    expect(table).toContain("effectiveTurn !== state.seat");
    expect(table).toContain("tributePending");
    expect(table).toContain("state.trickComplete");
  });
});
