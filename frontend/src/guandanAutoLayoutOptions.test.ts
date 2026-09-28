import { readFileSync } from "fs";
import { join } from "path";

describe("Guandan automatic layout options", () => {
  const table = readFileSync(join(__dirname, "GuandanTable.tsx"), "utf8");
  const css = readFileSync(
    join(__dirname, "guandan-auto-layout-options.css"),
    "utf8",
  );
  const privateLayoutCss = readFileSync(
    join(__dirname, "guandan-private-layout-20260928.css"),
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
    expect(table).toContain("选择组合：");
    expect(table).not.toContain("调整组合：");
    expect(table).toContain('id="guandan-auto-hand-layout-toolbar"');
    expect(table).toContain("横式排列");
    expect(table).toContain("竖式排列");
    expect(table).toContain("moveActiveAutoGroup");
    expect(table).toContain("splitActiveAutoGroup");
    expect(table).toContain("makeSelectedCustomGroup");
    expect(table).toContain("恢复方案");
    expect(table).toContain("一键出此组");
    expect(table).toContain("effectiveTurn !== state.seat");
    expect(table).toContain("tributePending");
    expect(table).toContain("state.trickComplete");
  });

  test("places the grouping tools on the right and stacks cards vertically", () => {
    expect(privateLayoutCss).toContain(
      "grid-template-columns: minmax(0, 1fr) clamp(154px, 12vw, 190px)",
    );
    expect(privateLayoutCss).toContain("grid-column: 2 !important");
    expect(privateLayoutCss).toContain("flex-direction: column !important");
    expect(privateLayoutCss).toContain(
      ".guandan-hand.guandan-auto-layout-vertical",
    );
    expect(privateLayoutCss).toContain("display: flex !important");
    expect(privateLayoutCss).toContain("margin-top: calc(");
  });
});
