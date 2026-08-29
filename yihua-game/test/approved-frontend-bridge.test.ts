import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { renderJoinPage } from "../src/core/join-page.js";

describe("approved Guandan frontend clean-room bridge", () => {
  it("keeps the clean-room entry page as the approved join-room screen", () => {
    const html = renderJoinPage("manual-test");
    expect(html).toContain('<h1 class="join-title">加入牌室</h1>');
    expect(html).toContain("开始人数：4–14 人");
    expect(html).toContain("您的姓名");
    expect(html).toContain("进入牌室");
  });

  it("mounts the original GuandanTable behind a compatibility transport", () => {
    const entry = readFileSync(
      new URL("../../frontend/src/CleanroomEntry.tsx", import.meta.url),
      "utf8",
    );
    const adapter = readFileSync(
      new URL(
        "../../frontend/src/CleanroomGuandanWebsocketProvider.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const table = readFileSync(
      new URL("../../frontend/src/GuandanTable.tsx", import.meta.url),
      "utf8",
    );

    expect(entry).toContain('import GuandanTable from "./GuandanTable"');
    expect(entry).toContain("<CleanroomGuandanWebsocketProvider");
    expect(entry).toContain("<GuandanStateProvider>");
    expect(entry).toContain("<GuandanTable />");
    expect(adapter).toContain('type: "play_cards", cardIds');
    expect(adapter).toContain('type: "pass_turn"');
    expect(adapter).toContain('type: "start_game"');
    expect(table).not.toContain("CleanroomGuandanWebsocketProvider");
    expect(table).toContain(
      "const GuandanTable: React.FunctionComponent = () =>",
    );
  });

  it("makes the clean-room branch root enter through CleanroomEntry", () => {
    const index = readFileSync(
      new URL("../../frontend/src/index.tsx", import.meta.url),
      "utf8",
    );
    expect(index).toContain('import CleanroomEntry from "./CleanroomEntry"');
    expect(index).toContain('(game === null && params.get("classic") !== "1")');
    expect(index).toContain("<CleanroomEntry />");
  });
});
