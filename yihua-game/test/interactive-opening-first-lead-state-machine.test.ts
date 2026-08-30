import { describe, expect, it } from "vitest";
import { createLobbyState } from "../src/core/game-state.js";
import { classifyHand } from "../src/core/hand.js";
import {
  transitionInteractiveGame,
  type InteractiveGameState,
} from "../src/core/interactive-game-machine.js";

const stableRandom = (): number => 0.999999;

const startFourPlayerTable = (): Extract<
  InteractiveGameState,
  { phase: "playing" }
> => {
  const lobby = createLobbyState(4, 0);
  const state = transitionInteractiveGame(
    lobby,
    { type: "start-interactive-first-round" },
    stableRandom,
  );
  if (state.phase !== "playing") throw new Error("expected playing state");
  return state;
};

describe("interactive opening winner first classified table play", () => {
  it("lets the opening-draw winner establish the first table lead by card id", () => {
    const state = startFourPlayerTable();
    const winner = state.openingDraw.winnerSeat;
    const firstCard = state.hands[winner]?.[0];
    if (!firstCard) throw new Error("opening winner must have a dealt hand");

    expect(classifyHand([firstCard.card]).kind).toBe("single");

    const next = transitionInteractiveGame(state, {
      type: "play-card-ids",
      seat: winner,
      cardIds: [firstCard.id],
    });

    expect(next.phase).toBe("playing");
    if (next.phase !== "playing") return;
    expect(next.hands[winner]).toHaveLength(state.hands[winner]!.length - 1);
    expect(next.trick.leadingPlay?.seat).toBe(winner);
    expect(next.trick.leadingPlay?.cards).toEqual([firstCard.card]);
    expect(classifyHand(next.trick.leadingPlay?.cards ?? []).kind).toBe(
      "single",
    );
  });

  it("rejects a non-winner trying to steal the first lead after the opening draw", () => {
    const state = startFourPlayerTable();
    const winner = state.openingDraw.winnerSeat;
    const wrongSeat = (winner + 1) % state.config.playerCount;
    const firstCard = state.hands[wrongSeat]?.[0];
    if (!firstCard) throw new Error("non-winner must have a dealt hand");

    expect(() =>
      transitionInteractiveGame(state, {
        type: "play-card-ids",
        seat: wrongSeat,
        cardIds: [firstCard.id],
      }),
    ).toThrow();
  });
});
