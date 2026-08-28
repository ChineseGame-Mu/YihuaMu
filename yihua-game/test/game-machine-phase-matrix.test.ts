import { describe, expect, it } from "vitest";
import {
  transitionGame,
  type GameMachineAction,
} from "../src/core/game-machine.js";
import {
  completeRound,
  createLobbyState,
  type GameState,
} from "../src/core/game-state.js";

const fixedRandom = () => 0.25;

const actions: readonly GameMachineAction[] = [
  { type: "begin-opening-draw" },
  { type: "deal-after-opening-draw" },
  { type: "play-cards", seat: 0, cards: [] },
  { type: "pass-turn", seat: 0 },
  { type: "next-round" },
];

const makeStates = (): Record<GameState["phase"], GameState> => {
  const lobby = createLobbyState(4, 0);
  const opening = transitionGame(
    lobby,
    { type: "begin-opening-draw" },
    fixedRandom,
  );
  const playing = transitionGame(
    opening,
    { type: "deal-after-opening-draw" },
    fixedRandom,
  );
  if (playing.phase !== "playing") {
    throw new Error("playing phase expected");
  }
  const completed = completeRound(playing, playing.currentTurn);
  return {
    lobby,
    "opening-draw": opening,
    playing,
    "round-complete": completed,
  };
};

describe("game machine phase/action rejection matrix", () => {
  it("rejects every action that is illegal for each phase before domain validation", () => {
    const states = makeStates();
    const allowed: Record<
      GameState["phase"],
      ReadonlySet<GameMachineAction["type"]>
    > = {
      lobby: new Set(["begin-opening-draw"]),
      "opening-draw": new Set(["deal-after-opening-draw"]),
      playing: new Set(["play-cards", "pass-turn"]),
      "round-complete": new Set(["next-round"]),
    };

    for (const [phase, state] of Object.entries(states) as [
      GameState["phase"],
      GameState,
    ][]) {
      for (const action of actions) {
        if (allowed[phase].has(action.type)) continue;
        expect(() => transitionGame(state, action, fixedRandom)).toThrow(
          `cannot ${action.type} while game is ${phase}`,
        );
      }
    }
  });

  it("runs the only legal phase-changing path without skipping or replaying phases", () => {
    const lobby = createLobbyState(4, 0);
    expect(lobby.phase).toBe("lobby");

    const opening = transitionGame(
      lobby,
      { type: "begin-opening-draw" },
      fixedRandom,
    );
    expect(opening.phase).toBe("opening-draw");
    if (opening.phase !== "opening-draw") {
      throw new Error("opening phase expected");
    }
    const openingDraw = opening.openingDraw;

    const playing = transitionGame(
      opening,
      { type: "deal-after-opening-draw" },
      fixedRandom,
    );
    expect(playing.phase).toBe("playing");
    if (playing.phase !== "playing") {
      throw new Error("playing phase expected");
    }
    expect(playing.openingDraw).toEqual(openingDraw);

    const completed = completeRound(playing, playing.currentTurn);
    expect(completed.phase).toBe("round-complete");
    expect(completed.openingDraw).toEqual(openingDraw);

    const nextRound = transitionGame(
      completed,
      { type: "next-round" },
      fixedRandom,
    );
    expect(nextRound.phase).toBe("playing");
    if (nextRound.phase !== "playing") {
      throw new Error("playing phase expected");
    }
    expect(nextRound.openingDraw).toEqual(openingDraw);
    expect(nextRound.currentTurn).toBe(completed.winnerSeat);
    expect(nextRound.trick.leaderSeat).toBe(completed.winnerSeat);
  });
});
