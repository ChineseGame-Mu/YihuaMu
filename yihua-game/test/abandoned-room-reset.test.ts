import { describe, expect, it } from "vitest";
import {
  ABANDONED_ROOM_RECONNECT_GRACE_MS,
  RoomManager,
} from "../src/core/room-manager.js";
import { addHuman, disconnectHuman } from "../src/core/room.js";

describe("abandoned active room reset", () => {
  it("preserves disconnected players during the reconnect grace period", () => {
    const rooms = new RoomManager();
    let managed = rooms.create("0004", 4);

    for (let seat = 0; seat < 4; seat += 1) {
      managed = rooms.set("0004", {
        ...managed,
        room: addHuman(managed.room, {
          id: `legacy:old${seat + 1}`,
          name: `old${seat + 1}`,
          seat,
        }),
      });
    }

    managed = rooms.start(
      "0004",
      () => 0.25,
      () => 1_000,
    );
    expect(managed.game.phase).not.toBe("lobby");

    for (let seat = 0; seat < 4; seat += 1) {
      managed = rooms.set("0004", {
        ...managed,
        room: disconnectHuman(managed.room, `legacy:old${seat + 1}`, 2_000),
      });
    }

    const preserved = rooms.get(
      "0004",
      2_000 + ABANDONED_ROOM_RECONNECT_GRACE_MS - 1,
    );
    expect(preserved.game.phase).not.toBe("lobby");
    expect(preserved.room.participants).toHaveLength(4);
    expect(
      preserved.room.participants.every(({ connected }) => !connected),
    ).toBe(true);

    const reset = rooms.get("0004", 2_000 + ABANDONED_ROOM_RECONNECT_GRACE_MS);
    expect(reset.game.phase).toBe("lobby");
    expect(reset.room.participants).toEqual([]);
    expect(reset.room.roomId).toBe("0004");
    expect(reset.room.config.playerCount).toBe(4);
  });
});
