import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import { transitionGame } from "../src/core/game-machine.js";
import { createLobbyState } from "../src/core/game-state.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

const deterministicRandom = (): number => 0;
const singleSeven: Card = { kind: "suited", suit: "clubs", rank: "7" };

describe("game machine phase guards", () => {
  for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
    it(`accepts only lobby actions before the first round at ${playerCount} seats`, () => {
      const lobby = createLobbyState(playerCount, 0);

      expect(() =>
        transitionGame(lobby, { type: "deal-after-opening-draw" }, deterministicRandom),
      ).toThrow("cannot deal-after-opening-draw while game is lobby");
      expect(() =>
        transitionGame(
          lobby,
          { type: "play-cards", seat: 0, cards: [singleSeven] },
          deterministicRandom,
        ),
      ).toThrow("cannot play-cards while game is lobby");
      expect(() =>
        transitionGame(lobby, { type: "pass-turn", seat: 0 }, deterministicRandom),
      ).toThrow("cannot pass-turn while game is lobby");
      expect(() =>
        transitionGame(lobby, { type: "next-round" }, deterministicRandom),
      ).toThrow("cannot next-round while game is lobby");
    });

    it(`locks opening draw until the dedicated deal transition at ${playerCount} seats`, () => {
      const opening = transitionGame(
        createLobbyState(playerCount, 0),
        { type: "begin-opening-draw" },
        deterministicRandom,
      );

      expect(opening.phase).toBe("opening-draw");
      expect(() =>
        transitionGame(opening, { type: "begin-opening-draw" }, deterministicRandom),
      ).toThrow("cannot begin-opening-draw while game is opening-draw");
      expect(() =>
        transitionGame(opening, { type: "start-first-round" }, deterministicRandom),
      ).toThrow("cannot start-first-round while game is opening-draw");
      expect(() =>
        transitionGame(
          opening,
          { type: "play-cards", seat: 0, cards: [singleSeven] },
          deterministicRandom,
        ),
      ).toThrow("cannot play-cards while game is opening-draw");
    });

    it(`prevents reopening or redealing once play has started at ${playerCount} seats`, () => {
      const playing = transitionGame(
        createLobbyState(playerCount, 0),
        { type: "start-first-round" },
        deterministicRandom,
      );

      expect(playing.phase).toBe("playing");
      expect(() =>
        transitionGame(playing, { type: "begin-opening-draw" }, deterministicRandom),
      ).toThrow("cannot begin-opening-draw while game is playing");
      expect(() =>
        transitionGame(playing, { type: "deal-after-opening-draw" }, deterministicRandom),
      ).toThrow("cannot deal-after-opening-draw while game is playing");
      expect(() =>
        transitionGame(playing, { type: "start-first-round" }, deterministicRandom),
      ).toThrow("cannot start-first-round while game is playing");
      expect(() =>
        transitionGame(playing, { type: "next-round" }, deterministicRandom),
      ).toThrow("cannot next-round while game is playing");
    });
  }
});
