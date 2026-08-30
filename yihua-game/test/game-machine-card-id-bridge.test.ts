import { describe, expect, it } from "vitest";
import {
  transitionGame,
  transitionGameCardIds,
} from "../src/core/game-machine.js";
import { createLobbyState } from "../src/core/game-state.js";

const zeroRandom = (): number => 0;

describe("game machine card id bridge", () => {
  it("removes the exact physical card selected by id", () => {
    const started = transitionGame(
      createLobbyState(4, 0),
      { type: "start-first-round" },
      zeroRandom,
    );
    expect(started.phase).toBe("playing");
    if (started.phase !== "playing") return;

    const first = started.hands[0]![0]!;
    const beforeIds = started.hands[0]!.map(({ id }) => id);
    const next = transitionGameCardIds(started, 0, [first.id]);
    const afterIds = next.hands[0]!.map(({ id }) => id);

    expect(beforeIds).toContain(first.id);
    expect(afterIds).not.toContain(first.id);
    expect(afterIds).toHaveLength(beforeIds.length - 1);
  });

  it("rejects duplicate ids instead of mutating the table twice", () => {
    const started = transitionGame(
      createLobbyState(4, 0),
      { type: "start-first-round" },
      zeroRandom,
    );
    expect(started.phase).toBe("playing");
    if (started.phase !== "playing") return;

    const first = started.hands[0]![0]!;
    expect(() =>
      transitionGameCardIds(started, 0, [first.id, first.id]),
    ).toThrow("card ids must be unique");
  });
});
