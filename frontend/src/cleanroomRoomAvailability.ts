export const CLEANROOM_ROOM_IDS = [
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
] as const;

export type CleanroomRoomId = (typeof CLEANROOM_ROOM_IDS)[number];

export interface CleanroomRoomSummary {
  readonly roomId: string;
  readonly humanCount: number;
  readonly phase: string;
}

export interface CleanroomRoomAvailability {
  readonly humanCount: number;
  readonly phase: string;
}

export const availabilityByVisibleRoom = (
  summaries: readonly CleanroomRoomSummary[],
): Readonly<Partial<Record<CleanroomRoomId, CleanroomRoomAvailability>>> => {
  const byRoom = new Map(summaries.map((summary) => [summary.roomId, summary]));
  return Object.fromEntries(
    CLEANROOM_ROOM_IDS.map((roomId) => {
      const summary = byRoom.get(roomId);
      return [
        roomId,
        summary === undefined
          ? { humanCount: 0, phase: "lobby" }
          : { humanCount: summary.humanCount, phase: summary.phase },
      ];
    }),
  );
};

export const cleanroomRoomOptionLabel = (
  room: CleanroomRoomId,
  availability: CleanroomRoomAvailability | undefined,
): string => {
  if (availability === undefined) return `${room}（查询中…）`;
  if (availability.humanCount === 0) return `${room}（空房）`;
  if (availability.phase === "lobby") {
    return `${room}（已有 ${availability.humanCount} 人）`;
  }
  return `${room}（游戏中，${availability.humanCount} 人在线）`;
};
