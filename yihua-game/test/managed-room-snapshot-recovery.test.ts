import { describe, expect, it } from "vitest";

import {
  decodeManagedRoomSnapshot,
  encodeManagedRoomSnapshot,
} from "../src/core/managed-room-snapshot.js";
import { RoomManager } from "../src/core/room-manager.js";
import { addHuman } from "../src/core/room.js";

const deterministicRandom = (): (() => number) => {
  let state = 0x5eed1234;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

describe("managed room snapshot recovery", () => {
  it("restores an active game without losing revision, hands, or turn state", () => {
    const beforeRestart = new RoomManager();
    let managed = beforeRestart.create("restart-room", 4);

    for (let seat = 0; seat < 4; seat += 1) {
      managed = beforeRestart.set("restart-room", {
        ...managed,
        room: addHuman(managed.room, {
          id: `p${seat}`,
          name: `玩家${seat + 1}`,
          seat,
        }),
      });
    }

    const started = beforeRestart.start("restart-room", deterministicRandom());
    expect(started.game.phase).toBe("playing");
    if (started.game.phase !== "playing") return;

    const leadSeat = started.game.currentTurn;
    const selected = started.game.hands[leadSeat]?.[0];
    expect(selected).toBeDefined();
    if (!selected) return;

    const played = beforeRestart.play("restart-room", leadSeat, [selected.id]);
    expect(played.game.phase).toBe("playing");

    const snapshot = encodeManagedRoomSnapshot(played);
    const decoded = decodeManagedRoomSnapshot(snapshot);
    const afterRestart = new RoomManager();
    const restored = afterRestart.restore(decoded);

    expect(restored.revision).toBe(played.revision);
    expect(restored.game).toEqual(played.game);
    expect(restored.room.roomId).toBe(played.room.roomId);
    expect(
      restored.room.participants
        .filter(({ kind }) => kind === "human")
        .every(({ connected }) => connected === false),
    ).toBe(true);

    expect(afterRestart.get("restart-room")).toEqual(restored);
    expect(afterRestart.listRoomIds()).toEqual(["restart-room"]);
  });

  it("rejects unsupported snapshot versions and inconsistent table sizes", () => {
    expect(() =>
      decodeManagedRoomSnapshot(JSON.stringify({ version: 2, managed: {} })),
    ).toThrow("unsupported room snapshot version");

    const manager = new RoomManager();
    const managed = manager.create("invalid-snapshot", 4);
    const parsed = JSON.parse(encodeManagedRoomSnapshot(managed)) as {
      version: number;
      managed: {
        game: { config: { playerCount: number } };
      };
    };
    parsed.managed.game.config.playerCount = 6;

    expect(() => decodeManagedRoomSnapshot(JSON.stringify(parsed))).toThrow(
      "snapshot game and room player counts differ",
    );
  });
});
