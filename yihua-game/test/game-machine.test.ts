import { describe, expect, it } from "vitest";
import { transitionGame } from "../src/core/game-machine.js";
import { completeRound, createLobbyState } from "../src/core/game-state.js";

const fixedRandom = () => 0.25;

describe("explicit table game state machine", () => {
  it("keeps opening draw independent from dealing and starts with its winner", () => {
    const lobby = createLobbyState(4, 0);
    const opening = transitionGame(
      lobby,
      { type: "begin-opening-draw" },
      fixedRandom,
    );
    expect(opening.phase).toBe("opening-draw");
    if (opening.phase !== "opening-draw")
      throw new Error("opening phase expected");

    const drawSnapshot = JSON.stringify(opening.openingDraw);
    const playing = transitionGame(
      opening,
      { type: "deal-after-opening-draw" },
      fixedRandom,
    );
    expect(playing.phase).toBe("playing");
    if (playing.phase !== "playing") throw new Error("playing phase expected");
    expect(JSON.stringify(playing.openingDraw)).toBe(drawSnapshot);
    expect(playing.currentTurn).toBe(opening.openingDraw.winnerSeat);
    expect(playing.trick.leaderSeat).toBe(opening.openingDraw.winnerSeat);
    expect(playing.hands.every((hand) => hand.length === 27)).toBe(true);
  });

  it("rejects actions that do not belong to the current phase", () => {
    const lobby = createLobbyState(4, 0);
    expect(() =>
      transitionGame(lobby, { type: "deal-after-opening-draw" }, fixedRandom),
    ).toThrow("cannot deal-after-opening-draw while game is lobby");
    expect(() =>
      transitionGame(lobby, { type: "pass-turn", seat: 0 }, fixedRandom),
    ).toThrow("cannot pass-turn while game is lobby");
  });

  it("moves round-complete back to playing with a fresh 27-card deal", () => {
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
    if (playing.phase !== "playing") throw new Error("playing phase expected");

    const completed = completeRound(playing, playing.currentTurn);
    const next = transitionGame(completed, { type: "next-round" }, fixedRandom);
    expect(next.phase).toBe("playing");
    if (next.phase !== "playing") throw new Error("playing phase expected");
    expect(next.hands.every((hand) => hand.length === 27)).toBe(true);
    expect(next.openingDraw).toEqual(completed.openingDraw);
    expect(next.currentTurn).toBe(completed.winnerSeat);
  });
});
