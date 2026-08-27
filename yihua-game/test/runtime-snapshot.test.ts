import { describe, expect, it } from "vitest";

import { addHuman } from "../src/core/room.js";
import { createServerRuntime } from "../src/core/server-runtime.js";

const deterministicRandom = (): (() => number) => {
  let state = 0x6d2b79f5;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

describe("runtime snapshots", () => {
  it("restores an active game with the exact revision and card identities", () => {
    const runtime = createServerRuntime();
    let managed = runtime.rooms.create("recover-room", 4);

    for (let seat = 0; seat < 4; seat += 1) {
      managed = runtime.rooms.set("recover-room", {
        ...managed,
        room: addHuman(managed.room, {
          id: `p${seat}`,
          name: `玩家${seat + 1}`,
          seat,
        }),
      });
    }

    const started = runtime.rooms.start("recover-room", deterministicRandom());
    expect(started.game.phase).toBe("playing");
    if (started.game.phase !== "playing") return;

    const leader = started.game.currentTurn;
    const cardId = started.game.hands[leader]![0]!.id;
    const played = runtime.rooms.play("recover-room", leader, [cardId]);
    const snapshot = runtime.snapshot();

    const recovered = createServerRuntime(snapshot).rooms.get("recover-room");
    expect(recovered).toEqual(played);
    expect(recovered.revision).toBe(played.revision);
    expect(recovered.game.phase).toBe("playing");
    if (recovered.game.phase !== "playing") return;

    const allIds = recovered.game.hands.flat().map(({ id }) => id);
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(allIds).not.toContain(cardId);
  });
});
