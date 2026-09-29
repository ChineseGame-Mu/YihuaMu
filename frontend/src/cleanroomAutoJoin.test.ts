import { shouldAutoJoinCleanroom } from "./cleanroomAutoJoin";

describe("cleanroom direct room links", () => {
  it("opens the table for an explicit named room link", () => {
    expect(
      shouldAutoJoinCleanroom(
        "?cleanroom=1&game=guandan&autoJoin=1&room=0004&name=Yihua%20Mu",
      ),
    ).toBe(true);
  });

  it("keeps the room-entry form for ordinary links", () => {
    expect(shouldAutoJoinCleanroom("?cleanroom=1&room=0004")).toBe(false);
    expect(
      shouldAutoJoinCleanroom(
        "?cleanroom=1&game=guandan&autoJoin=1&room=0004",
      ),
    ).toBe(false);
  });
});
