import { describe, expect, test } from "vitest";

import {
  prepareLegacyTribute,
  runLegacyRobotTribute,
} from "../src/core/legacy-tribute.js";
import { addHuman, setRobotCount } from "../src/core/room.js";
import { createServerRuntime } from "../src/core/server-runtime.js";

describe("legacy robot next-round automation", () => {
  test("robot loser pays tribute and robot winner returns a card automatically", async () => {
    const runtime = createServerRuntime();
    const roomId = "robot-tribute-auto";
    let managed = runtime.rooms.create(roomId, 4);
    managed = runtime.rooms.set(roomId, {
      ...managed,
      room: setRobotCount(
        addHuman(managed.room, {
          id: "human-2",
          name: "真人3",
          seat: 2,
        }),
        3,
      ),
    });
    managed = runtime.rooms.start(roomId, () => 0.314159);
    if (managed.game.phase !== "playing") {
      throw new Error("playing phase expected");
    }

    const handsBefore = managed.game.hands.map((hand) =>
      hand.map(({ id }) => id),
    );
    prepareLegacyTribute(roomId, [0, 1, 2, 3]);
    await runLegacyRobotTribute(runtime, roomId);

    const finalized = runtime.rooms.get(roomId);
    expect(finalized.tribute).toBeUndefined();
    if (finalized.game.phase !== "playing") {
      throw new Error("playing phase expected after robot exchange");
    }
    expect(finalized.game.currentTurn).toBe(3);
    expect(finalized.game.hands.every((hand) => hand.length === 27)).toBe(true);
    expect(finalized.game.hands[0]!.map(({ id }) => id)).not.toEqual(
      handsBefore[0],
    );
    expect(finalized.game.hands[3]!.map(({ id }) => id)).not.toEqual(
      handsBefore[3],
    );
  });
});
