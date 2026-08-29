import { describe, expect, it } from "vitest";
import {
  createLobbyState,
  completeRound,
  startGame,
  startOpeningDraw,
} from "../src/core/game-state.js";
import { availableGameMachineActions } from "../src/core/game-machine.js";

describe("table-machine action availability", () => {
  it("exposes opening draw and direct first-round start from the lobby", () => {
    const state = createLobbyState(4, 0);

    expect(availableGameMachineActions(state)).toEqual([
      "begin-opening-draw",
      "start-first-round",
    ]);
  });

  it("exposes only deal after the opening draw has a winner", () => {
    const state = startOpeningDraw(createLobbyState(4, 0), () => 0.5);

    expect(availableGameMachineActions(state)).toEqual([
      "deal-after-opening-draw",
    ]);
  });

  it("exposes play and pass controls while a round is active", () => {
    const state = startGame(createLobbyState(4, 0), () => 0.5);

    expect(availableGameMachineActions(state)).toEqual([
      "play-cards",
      "pass-turn",
    ]);
  });

  it("exposes only next-round after round completion", () => {
    const playing = startGame(createLobbyState(4, 0), () => 0.5);
    const completed = completeRound(playing, playing.openingDraw.winnerSeat);

    expect(availableGameMachineActions(completed)).toEqual(["next-round"]);
  });
});
