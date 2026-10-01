import { describe, expect, test } from "vitest";

import { completeRound } from "../src/core/game-state.js";
import { advanceLegacyRobotNextRound } from "../src/core/legacy-guandan-gateway.js";
import {
  prepareLegacyTribute,
  runLegacyRobotTribute,
} from "../src/core/legacy-tribute.js";
import { addHuman, setRobotCount } from "../src/core/room.js";
import { createServerRuntime } from "../src/core/server-runtime.js";

describe("legacy robot next-round automation", () => {
  test("first-place robot deals and opens the next round without a human click", async () => {
    const runtime = createServerRuntime();
    const roomId = "robot-first-place-auto-deal";
    let managed = runtime.rooms.create(roomId, 4);
    managed = runtime.rooms.set(roomId, {
      ...managed,
      room: setRobotCount(
        addHuman(managed.room, {
          id: "human-0",
          name: "真人1",
          seat: 0,
        }),
        3,
      ),
    });
    managed = runtime.rooms.start(roomId, () => 0.271828);
    if (managed.game.phase !== "playing") {
      throw new Error("playing phase expected");
    }

    const finishOrder = [1, 3, 0, 2] as const;
    const completed = completeRound(
      { ...managed.game, finishedSeats: finishOrder },
      finishOrder[0],
    );
    runtime.rooms.set(roomId, { ...managed, game: completed });

    await expect(advanceLegacyRobotNextRound(runtime, roomId)).resolves.toBe(
      true,
    );

    const next = runtime.rooms.get(roomId);
    if (next.game.phase !== "playing") {
      throw new Error("playing phase expected after automatic next round");
    }
    expect(next.game.finishedSeats).toEqual([]);
    expect(next.game.hands.every((hand) => hand.length <= 27)).toBe(true);
    expect(next.game.hands.some((hand) => hand.length < 27)).toBe(true);
  }, 15_000);

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
