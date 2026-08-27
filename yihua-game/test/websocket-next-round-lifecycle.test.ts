import { describe, expect, it } from "vitest";

import { completeRound } from "../src/core/game-state.js";
import { addHuman } from "../src/core/room.js";
import { createServerRuntime } from "../src/core/server-runtime.js";
import type { TextSocket } from "../src/core/websocket-service.js";

class RecordingSocket implements TextSocket {
  readonly sent: string[] = [];

  send(text: string): void {
    this.sent.push(text);
  }
}

const deterministicRandom = (): (() => number) => {
  let state = 0x1234abcd;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

describe("websocket next-round lifecycle", () => {
  it("redeals once, preserves opening draw, and gives first place the lead", async () => {
    const runtime = createServerRuntime();
    let managed = runtime.rooms.create("next-round-room", 4);

    for (let seat = 0; seat < 4; seat += 1) {
      managed = runtime.rooms.set("next-round-room", {
        ...managed,
        room: addHuman(managed.room, {
          id: `p${seat}`,
          name: `玩家${seat + 1}`,
          seat,
        }),
      });
    }

    const started = runtime.rooms.start("next-round-room", deterministicRandom());
    expect(started.game.phase).toBe("playing");
    if (started.game.phase !== "playing") return;

    const finishOrder = [2, 0, 3, 1] as const;
    const completed = completeRound(
      { ...started.game, finishedSeats: finishOrder },
      finishOrder[0],
    );
    const before = runtime.rooms.set("next-round-room", {
      ...started,
      game: completed,
    });
    const openingDrawBefore = JSON.stringify(completed.openingDraw);

    const socket = new RecordingSocket();
    const command = JSON.stringify({
      type: "next_round",
      expectedRevision: before.revision,
      commandId: "next-round-once",
    });

    await runtime.websocket.handleText(
      socket,
      { roomId: "next-round-room" },
      command,
    );

    const next = runtime.rooms.get("next-round-room");
    expect(next.revision).toBe(before.revision + 1);
    expect(next.game.phase).toBe("playing");
    if (next.game.phase !== "playing") return;
    expect(next.game.currentTurn).toBe(finishOrder[0]);
    expect(next.game.hands.map((hand) => hand.length)).toEqual([27, 27, 27, 27]);
    expect(JSON.stringify(next.game.openingDraw)).toBe(openingDrawBefore);

    const handIdsAfterFirstCommand = next.game.hands.map((hand) =>
      hand.map(({ id }) => id),
    );
    await runtime.websocket.handleText(
      socket,
      { roomId: "next-round-room" },
      command,
    );

    const retried = runtime.rooms.get("next-round-room");
    expect(retried.revision).toBe(next.revision);
    expect(retried.game.phase).toBe("playing");
    if (retried.game.phase !== "playing") return;
    expect(retried.game.hands.map((hand) => hand.map(({ id }) => id))).toEqual(
      handIdsAfterFirstCommand,
    );
    expect(JSON.stringify(retried.game.openingDraw)).toBe(openingDrawBefore);
  });
});
