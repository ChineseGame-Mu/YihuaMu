import { readFileSync } from "fs";
import { join } from "path";

describe("clean-room lobby artwork controls", () => {
  const css = readFileSync(
    join(__dirname, "cleanroom-lobby-artwork.css"),
    "utf8",
  );

  test("aligns the October 17 approved artwork controls", () => {
    expect(css).toContain(".cleanroom-final-room {");
    expect(css).toContain("top:54.38%!important;height:5.20%!important");
    expect(css).toContain(
      ".cleanroom-final-name {top:64.80%!important;height:5.20%!important",
    );
    expect(css).toContain(
      ".cleanroom-final-enter {left:26.90%!important;top:72.65%!important",
    );
    expect(css).not.toContain(".cleanroom-final-no-count-mask");
  });
});
