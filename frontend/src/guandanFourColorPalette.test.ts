import { readFileSync } from "fs";
import { join } from "path";

const diamondFiles = [
  "2D",
  "3D",
  "4D",
  "5D",
  "6D",
  "7D",
  "8D",
  "9D",
  "Td",
  "Jd",
  "Qd",
  "Kd",
  "Ad",
];

describe("four-color suit palette", () => {
  test("uses red hearts, orange diamonds, green clubs, and black spades", () => {
    for (const card of diamondFiles) {
      const source = readFileSync(
        join(__dirname, "generated", "playing-cards-4color", `${card}.tsx`),
        "utf8",
      );
      expect(source).toContain("#f5a623");
      expect(source).not.toContain("#00f");
    }
  });

  test("describes the visible four-color option accurately", () => {
    const table = readFileSync(join(__dirname, "GuandanTable.tsx"), "utf8");
    expect(table).toContain("四色（黑 / 红 / 橘黄 / 绿）");
    expect(table).not.toContain("四色（黑 / 红 / 蓝 / 绿）");
  });
});
