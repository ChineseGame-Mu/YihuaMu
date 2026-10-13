import { describe, expect, it } from "vitest";
import { transitionGame } from "../src/core/game-machine.js";
import { completeRound, createLobbyState } from "../src/core/game-state.js";

const fixedRandom = () => 0.25;

const makePlaying = () => {
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
  return playing;
};

describe("round winner handoff", () => {
  it("gives the prior winner both next-round leader and current turn", () => {
    const playing = makePlaying();
    const winnerSeat = (playing.currentTurn + 1) % playing.config.playerCount;
    const completed = completeRound(playing, winnerSeat);
    const next = transitionGame(completed, { type: "next-round" }, fixedRandom);

    expect(next.phase).toBe("playing");
    if (next.phase !== "playing") {
      throw new Error("playing phase expected");
    }
    expect(next.currentTurn).toBe(winnerSeat);
    expect(next.trick.leaderSeat).toBe(winnerSeat);
    expect(next.trick.currentTurn).toBe(winnerSeat);
    expect(next.trick.leadingPlay).toBeNull();
    expect(next.trick.passedSeats).toEqual([]);
    expect(next.trick.completedTricks).toBe(0);
    expect(next.finishedSeats).toEqual([]);
  });

  it("preserves the original opening draw while resetting every hand to 27 cards", () => {
    const playing = makePlaying();
    const openingDraw = playing.openingDraw;
    const completed = completeRound(playing, playing.currentTurn);
    const next = transitionGame(completed, { type: "next-round" }, fixedRandom);

    expect(next.phase).toBe("playing");
    if (next.phase !== "playing") {
      throw new Error("playing phase expected");
    }
    expect(next.openingDraw).toEqual(openingDraw);
    expect(next.hands).toHaveLength(playing.config.playerCount);
    expect(next.hands.every((hand) => hand.length === 27)).toBe(true);
  });
});
