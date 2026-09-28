import { readFileSync } from "fs";
import { join } from "path";

describe("clean-room lobby artwork controls", () => {
  const css = readFileSync(
    join(__dirname, "cleanroom-lobby-artwork.css"),
    "utf8",
  );

  test("keeps the name field below the artwork name label", () => {
    expect(css).toContain(".cleanroom-final-name {top:69.25%!important");
    expect(css).toContain("top:69.10%!important;height:4.55%!important");
  });
});
