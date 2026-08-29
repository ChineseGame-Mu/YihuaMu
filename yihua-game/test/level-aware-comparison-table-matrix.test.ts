import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { classifyHandWithLevel } from "../src/core/level-hand.js";
import {
  canHandBeatWithLevel,
  type ClassifiedHand,
} from "../src/core/hand.js";
import {
  playTableCardsWithLevel,
  type TableRoundState,
} from "../src/core/table-state-machine.js";
import type { SupportedPlayerCount } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const levelRank: Rank = "9";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const wildcard = (): Card => suited(levelRank, "hearts");

const classify = (cards: readonly Card[]): ClassifiedHand =>
  classifyHandWithLevel(cards, levelRank);

const playingState = (playerCount: SupportedPlayerCount): TableRoundState => ({
  playerCount,
  phase: "playing",
  openingDraw: { remainingCards: [], attempts: [], winnerSeat: 0 },
  trick: createTrickState(playerCount, 0),
  activeSeats: Array.from({ length: playerCount }, (_, seat) => seat),
  finishingOrder: [],
});

describe("level-aware comparison and table matrix", () => {
  it("ranks the natural level single above an ace while preserving joker order", () => {
    const ace = classify([suited("A")]);
    const level = classify([suited(levelRank, "spades")]);
    const smallJoker = classify([{ kind: "joker", size: "small" }]);
    const bigJoker = classify([{ kind: "joker", size: "big" }]);

    expect(canHandBeatWithLevel(level, ace, levelRank)).toBe(true);
    expect(canHandBeatWithLevel(smallJoker, level, levelRank)).toBe(true);
    expect(canHandBeatWithLevel(bigJoker, smallJoker, levelRank)).toBe(true);
  });

  it("keeps straight-flush and bomb precedence correct with a level wildcard", () => {
    const straightFlush = classify([
      suited("6", "spades"),
      suited("7", "spades"),
      suited("8", "spades"),
      suited("10", "spades"),
      wildcard(),
    ]);
    const fiveBomb = classify([
      suited("Q"),
      suited("Q", "diamonds"),
      suited("Q", "spades"),
      suited("Q", "hearts"),
      wildcard(),
    ]);
    const sixBomb = classify([
      suited("K"),
      suited("K", "diamonds"),
      suited("K", "spades"),
      suited("K", "hearts"),
      suited("K"),
      wildcard(),
    ]);

    expect(straightFlush.kind).toBe("straight-flush");
    expect(fiveBomb).toMatchObject({ kind: "bomb", size: 5, rank: "Q" });
    expect(sixBomb).toMatchObject({ kind: "bomb", size: 6, rank: "K" });
    expect(canHandBeatWithLevel(straightFlush, fiveBomb, levelRank)).toBe(true);
    expect(canHandBeatWithLevel(sixBomb, straightFlush, levelRank)).toBe(true);
  });

  it.each([4, 6, 8, 10, 12, 14] as const)(
    "applies level-aware overcall strength on a live %i-player table",
    (playerCount) => {
      let state = playTableCardsWithLevel(
        playingState(playerCount),
        0,
        [suited("A")],
        levelRank,
      );

      state = playTableCardsWithLevel(
        state,
        1,
        [suited(levelRank, "spades")],
        levelRank,
      );

      expect(state.trick?.leadingPlay?.seat).toBe(1);
      expect(state.trick?.leadingPlay?.hand).toMatchObject({
        kind: "single",
        rank: levelRank,
      });
      expect(state.trick?.currentTurn).toBe(2);
      expect(state.trick?.passedSeats).toEqual([]);
    },
  );
});
