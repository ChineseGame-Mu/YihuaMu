import {
  availabilityByVisibleRoom,
  CLEANROOM_ROOM_IDS,
  cleanroomRoomOptionLabel,
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

  test("labels empty, occupied, and playing rooms without exposing names", () => {
    const availability = availabilityByVisibleRoom([
      { roomId: "0002", humanCount: 2, phase: "lobby" },
      { roomId: "0009", humanCount: 3, phase: "playing" },
    ]);
    expect(cleanroomRoomOptionLabel("0001", availability["0001"])).toBe(
      "0001（空房）",
    );
    expect(cleanroomRoomOptionLabel("0002", availability["0002"])).toBe(
      "0002（已有 2 人）",
    );
    expect(cleanroomRoomOptionLabel("0009", availability["0009"])).toBe(
      "0009（游戏中，3 人在线）",
    );
    expect(Object.keys(availability)).toEqual(CLEANROOM_ROOM_IDS);
  });

  test("keeps rooms selectable while the availability request is pending", () => {
    expect(cleanroomRoomOptionLabel("0010", undefined)).toBe("0010（查询中…）");
  });
});
