import { describe, expect, it } from "vitest";

import type { Card } from "../src/core/cards.js";
import { playGameCardIds } from "../src/core/game-actions.js";
import { createLobbyState, startGame } from "../src/core/game-state.js";

const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const cardKey = (card: Card): string =>
  card.kind === "joker"
    ? `joker:${card.size}`
    : `${card.suit}:${card.rank}`;

describe("exact card id game actions", () => {
  it("removes only the selected copy when equal card faces share a hand", () => {
    let duplicate:
      | {
          state: ReturnType<typeof startGame>;
          seat: number;
          keepId: string;
          playId: string;
        }
      | undefined;

    for (let seed = 1; seed <= 100 && duplicate === undefined; seed += 1) {
      const state = startGame(createLobbyState(4, 0), seededRandom(seed));
      const seat = state.currentTurn;
      const hand = state.hands[seat]!;
      const firstByFace = new Map<string, string>();

      for (const { id, card } of hand) {
        const key = cardKey(card);
        const firstId = firstByFace.get(key);
        if (firstId !== undefined) {
          duplicate = { state, seat, keepId: firstId, playId: id };
          break;
        }
        firstByFace.set(key, id);
      }
    }

    expect(duplicate).toBeDefined();
    if (!duplicate) return;

    const beforeCount = duplicate.state.hands[duplicate.seat]!.length;
    const next = playGameCardIds(duplicate.state, duplicate.seat, [
      duplicate.playId,
    ]);
    const hand = next.hands[duplicate.seat]!;

    expect(hand).toHaveLength(beforeCount - 1);
    expect(hand.some(({ id }) => id === duplicate.playId)).toBe(false);
    expect(hand.some(({ id }) => id === duplicate.keepId)).toBe(true);
  });
});
