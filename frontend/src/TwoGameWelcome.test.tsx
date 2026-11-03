import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Welcome from "./Welcome";

jest.mock("./PersonalSettingsButton", () => ({
  __esModule: true,
  default: () => <span>Personal settings</span>,
}));

describe("two-game welcome screen", () => {
  it("offers only Tractor and Finding Friends, never Guandan", () => {
    const html = renderToStaticMarkup(
      <Welcome connected onSelectGameMode={() => undefined} />,
    );
    expect(html).toContain("升级 / 拖拉机");
    expect(html).toContain("找朋友");
    expect(html).not.toContain("掼蛋");
    expect(html).not.toContain("Guandan");
  });
});
