import { readFileSync } from "fs";
import { join } from "path";

import { privateHandStackProgress } from "./guandanHandLayout";

describe("Guandan private hand viewport fit", () => {
  const css = readFileSync(
    join(__dirname, "cleanroom-hand-stack-fix.css"),
    "utf8",
  );
  const table = readFileSync(join(__dirname, "GuandanTable.tsx"), "utf8");

  test("anchors every stack from its first card to its final full card", () => {
    expect(privateHandStackProgress(0, 1)).toBe(1);
    expect(privateHandStackProgress(0, 5)).toBe(0);
    expect(privateHandStackProgress(2, 5)).toBe(0.5);
    expect(privateHandStackProgress(4, 5)).toBe(1);
    expect(privateHandStackProgress(26, 27)).toBe(1);
  });

  test("uses each card progress to keep the complete stack in my table", () => {
    expect(table).toContain(
      "privateHandStackProgress(stackIndex, stack.length) * 100",
    );
    expect(table).toContain(
      "privateHandStackProgress(stackIndex, stack.length) * -100",
    );
    expect(css).toMatch(/container-type:\s*size\s*!important/);
    expect(css).toMatch(/top:\s*var\(--guandan-stack-progress\)\s*!important/);
    expect(css).toMatch(
      /translate:\s*0\s+var\(--guandan-stack-offset\)\s*!important/,
    );
    expect(css).toMatch(
      /height:\s*var\(--guandan-private-card-height\)\s*!important/,
    );
    expect(css).toMatch(/overflow-y:\s*hidden\s*!important/);
  });

  test("keeps horizontal stacking inside the same adaptive card height", () => {
    expect(css).toMatch(
      /body\.guandan-hand-stack-horizontal[\s\S]*?height:\s*var\(--guandan-private-card-height\)\s*!important/,
    );
    expect(css).toMatch(
      /body\.guandan-hand-stack-horizontal[\s\S]*?position:\s*relative\s*!important[\s\S]*?top:\s*auto\s*!important/,
    );
  });
});
