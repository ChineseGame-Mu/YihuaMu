import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import { classifyHand } from "../src/core/hand.js";
import {
  transitionInteractiveGame,
  type InteractiveGameState,
} from "../src/core/interactive-game-machine.js";
import { createLobbyState } from "../src/core/game-state.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

const fixedRandom = (): number => 0;
const suited = (
  rank: Extract<Card, { kind: "suited" }>["rank"],
  suit: Extract<Card, { kind: "suited" }>["suit"] = "clubs",
): Card => ({
  kind: "suited",
  rank,
  suit,
});

describe("opening draw + hand classifier + table machine integration", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "deals %i players from the independent opening draw and accepts the winner's first legal play",
    (playerCount) => {
      let state: InteractiveGameState = createLobbyState(playerCount, 0);
      state = transitionInteractiveGame(
        state,
        { type: "begin-interactive-opening" },
        fixedRandom,
      );
      state = transitionInteractiveGame(
        state,
        { type: "complete-interactive-opening" },
        fixedRandom,
      );

      expect(state.phase).toBe("interactive-opening-draw");
      if (state.phase !== "interactive-opening-draw") return;
      const winnerSeat = state.draw.session.winnerSeat;
      expect(winnerSeat).not.toBeNull();

      state = transitionInteractiveGame(
        state,
        { type: "deal-after-interactive-opening" },
        fixedRandom,
      );
      expect(state.phase).toBe("playing");
      if (state.phase !== "playing" || winnerSeat === null) return;

      expect(state.currentTurn).toBe(winnerSeat);
      expect(state.hands).toHaveLength(playerCount);
      expect(state.hands.every((hand) => hand.length === 27)).toBe(true);

      const first = state.hands[winnerSeat]![0]!;
      expect(classifyHand([first.card]).kind).toBe("single");

      state = transitionInteractiveGame(state, {
        type: "play-cards",
        seat: winnerSeat,
        cards: [first.card],
      });
      expect(state.phase).toBe("playing");
      if (state.phase !== "playing") return;
      expect(state.hands[winnerSeat]).toHaveLength(26);
      expect(state.trick.leadingPlay?.seat).toBe(winnerSeat);
      expect(state.trick.leadingPlay?.cards).toEqual([first.card]);
    },
  );

  it.each([
    ["single", [suited("3")]],
    ["pair", [suited("4", "clubs"), suited("4", "diamonds")]],
    [
      "triple",
      [suited("5", "clubs"), suited("5", "diamonds"), suited("5", "spades")],
    ],
    [
      "full-house",
      [
        suited("6", "clubs"),
        suited("6", "diamonds"),
        suited("6", "spades"),
        suited("9", "clubs"),
        suited("9", "diamonds"),
      ],
    ],
    [
      "straight",
      [
        suited("3", "clubs"),
        suited("4", "diamonds"),
        suited("5", "spades"),
        suited("6", "hearts"),
        suited("7", "clubs"),
      ],
    ],
    [
      "straight-flush",
      [suited("3"), suited("4"), suited("5"), suited("6"), suited("7")],
    ],
    [
      "consecutive-pairs",
      [
        suited("7", "clubs"),
        suited("7", "diamonds"),
        suited("8", "clubs"),
        suited("8", "diamonds"),
        suited("9", "clubs"),
        suited("9", "diamonds"),
      ],
    ],
    [
      "consecutive-triples",
      [
        suited("10", "clubs"),
        suited("10", "diamonds"),
        suited("10", "spades"),
        suited("J", "clubs"),
        suited("J", "diamonds"),
        suited("J", "spades"),
      ],
    ],
    [
      "bomb",
      [
        suited("Q", "clubs"),
        suited("Q", "diamonds"),
        suited("Q", "spades"),
        suited("Q", "hearts"),
      ],
    ],
    [
      "joker-bomb",
      [
        { kind: "joker", size: "small" } as Card,
        { kind: "joker", size: "small" } as Card,
        { kind: "joker", size: "big" } as Card,
        { kind: "joker", size: "big" } as Card,
      ],
    ],
  ] as const)("classifies the complete table hand family %s", (kind, cards) => {
    expect(classifyHand(cards)).toMatchObject({ kind });
  });
});
