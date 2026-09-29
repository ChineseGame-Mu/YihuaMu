import { describe, expect, it } from "vitest";
import { createLobbyState } from "../src/core/game-state.js";
import { classifyHand } from "../src/core/hand.js";
import {
  availableInteractiveGameActions,
  transitionInteractiveGame,
} from "../src/core/interactive-game-machine.js";

const deterministicRandom = (() => {
  let state = 0x12345678;
  return (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
})();

describe("interactive opening to exact-card table state", () => {
  it("lets the opening-draw winner lead by exact card id and keeps hand identity exact", () => {
    const lobby = createLobbyState(4, 0);
    const started = transitionInteractiveGame(
      lobby,
      { type: "start-interactive-first-round" },
      deterministicRandom,
    );

    expect(started.phase).toBe("playing");
    if (started.phase !== "playing") throw new Error("expected playing state");

    const winner = started.openingDraw.winnerSeat;
    expect(started.currentTurn).toBe(winner);
    expect(started.trick.leaderSeat).toBe(winner);
    expect(availableInteractiveGameActions(started)).toContain("play-card-ids");

    const chosen = started.hands[winner]![0]!;
    const priorCount = started.hands[winner]!.length;
    const next = transitionInteractiveGame(started, {
      type: "play-card-ids",
      seat: winner,
      cardIds: [chosen.id],
    });

    expect(next.phase).toBe("playing");
    if (next.phase !== "playing") throw new Error("expected playing state");

    expect(next.hands[winner]).toHaveLength(priorCount - 1);
    expect(next.hands[winner]!.some(({ id }) => id === chosen.id)).toBe(false);
    expect(next.trick.leadingPlay?.seat).toBe(winner);
    expect(classifyHand(next.trick.leadingPlay?.cards ?? []).kind).toBe(
      "single",
    );
    expect(next.currentTurn).not.toBe(winner);
  });

  it("rejects an exact card id that is not in the acting seat hand", () => {
    const lobby = createLobbyState(4, 0);
    const started = transitionInteractiveGame(
      lobby,
      { type: "start-interactive-first-round" },
      deterministicRandom,
    );
    if (started.phase !== "playing") throw new Error("expected playing state");

    const winner = started.openingDraw.winnerSeat;
    expect(() =>
      transitionInteractiveGame(started, {
        type: "play-card-ids",
        seat: winner,
        cardIds: ["not-a-real-card-id"],
      }),
    ).toThrow("is not in seat's hand");
  });
});
