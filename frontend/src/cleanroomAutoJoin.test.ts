import { shouldAutoJoinCleanroom } from "./cleanroomAutoJoin";

describe("cleanroom direct room links", () => {
  it("opens the table for an explicit named room link", () => {
    expect(
      shouldAutoJoinCleanroom(
        "?cleanroom=1&game=guandan&autoJoin=1&room=0004&name=Yihua%20Mu",
      ),
    ).toBe(true);
  });

  it("keeps legacy production links working without the newer autoJoin flag", () => {
    expect(
      shouldAutoJoinCleanroom(
        "?cleanroom=1&game=guandan&cleanroomRoom=0004&room=0004&name=Yihua&players=4&test=1",
      ),
    ).toBe(true);
  });

  it("accepts cleanroomRoom as the canonical room when room is absent", () => {
    expect(
      shouldAutoJoinCleanroom(
        "?cleanroom=1&game=guandan&cleanroomRoom=0004&name=Yihua",
      ),
    ).toBe(true);
  });

  it("keeps the room-entry form for ordinary links", () => {
    expect(shouldAutoJoinCleanroom("?cleanroom=1&room=0004")).toBe(false);
    expect(
      shouldAutoJoinCleanroom("?cleanroom=1&game=guandan&autoJoin=1&room=0004"),
    ).toBe(false);
    expect(
      shouldAutoJoinCleanroom(
        "?cleanroom=1&game=guandan&autoJoin=0&room=0004&name=Yihua",
      ),
    ).toBe(false);
  });
});
