import {
  CLEANROOM_ROOM_IDS,
  availabilityByVisibleRoom,
  cleanroomRoomOptionLabel,
  isCleanroomRoomId,
} from "./cleanroomRoomAvailability";

describe("cleanroom room availability", () => {
  test("offers exactly rooms 0001 through 0010", () => {
    expect(CLEANROOM_ROOM_IDS).toEqual([
      "0001",
      "0002",
      "0003",
      "0004",
      "0005",
      "0006",
      "0007",
      "0008",
      "0009",
      "0010",
    ]);
  });

  test("validates every selectable room inside the table", () => {
    for (const room of CLEANROOM_ROOM_IDS) {
      expect(isCleanroomRoomId(room)).toBe(true);
    }
    expect(isCleanroomRoomId("0000")).toBe(false);
    expect(isCleanroomRoomId("0011")).toBe(false);
    expect(isCleanroomRoomId("1000")).toBe(false);
  });

  test("stops displaying querying indefinitely when the status endpoint fails", () => {
    expect(cleanroomRoomOptionLabel("0005", undefined)).toBe(
      "0005（查询中…）",
    );
    expect(cleanroomRoomOptionLabel("0005", undefined, true)).toBe(
      "0005（人数暂不可查）",
    );
    expect(
      cleanroomRoomOptionLabel(
        "0005",
        { humanCount: 0, phase: "lobby" },
        true,
      ),
    ).toBe("0005（人数暂不可查）");
    expect(
      cleanroomRoomOptionLabel("0005", { humanCount: 0, phase: "lobby" }),
    ).toBe("0005（空房）");
  });

  test("maps deployment room summaries back to visible room numbers", () => {
    const availability = availabilityByVisibleRoom(
      [
        { roomId: "cr-release-0002", humanCount: 2, phase: "lobby" },
        { roomId: "cr-release-0010", humanCount: 3, phase: "playing" },
      ],
      (room) => `cr-release-${room}`,
    );

    expect(cleanroomRoomOptionLabel("0001", availability["0001"])).toBe(
      "0001（空房）",
    );
    expect(cleanroomRoomOptionLabel("0002", availability["0002"])).toBe(
      "0002（已有 2 人）",
    );
    expect(cleanroomRoomOptionLabel("0010", availability["0010"])).toBe(
      "0010（游戏中，3 人在线）",
    );
  });
});
