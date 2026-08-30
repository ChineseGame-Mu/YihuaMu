import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { createDeck } from "../src/core/deck.js";
import { classifyHandWithLevel } from "../src/core/level-hand.js";
import {
  completeTableOpeningDraw,
  createTableRoundState,
  playTableCardsWithLevel,
} from "../src/core/table-state-machine.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const wild = (levelRank: Rank): Card => suited(levelRank, "hearts");
const fixedRandom = (): number => 0;

describe("multiple heart-level wildcards across complete hand judgement and table state", () => {
  it("classifies the composite hand families with two wildcards", () => {
    const level: Rank = "6";
    const w1 = wild(level);
    const w2 = wild(level);

    expect(
      classifyHandWithLevel(
        [suited("9"), suited("9", "spades"), w1, w2],
        level,
      ),
    ).toEqual({ kind: "bomb", size: 4, rank: "9" });

    expect(
      classifyHandWithLevel(
        [suited("Q"), suited("Q", "spades"), suited("8"), w1, w2],
        level,
      ),
    ).toEqual({ kind: "full-house", size: 5, rank: "Q" });

    expect(
      classifyHandWithLevel(
        [
          suited("7", "spades"),
          suited("8", "spades"),
          suited("10", "spades"),
          w1,
          w2,
        ],
        level,
      ),
    ).toEqual({ kind: "straight-flush", size: 5, highRank: "J" });

    expect(
      classifyHandWithLevel(
        [suited("7"), suited("7", "spades"), suited("8"), suited("9"), w1, w2],
        level,
      ),
    ).toEqual({ kind: "consecutive-pairs", size: 6, highRank: "9" });

    expect(
      classifyHandWithLevel(
        [
          suited("10"),
          suited("10", "spades"),
          suited("10", "diamonds"),
          suited("J"),
          w1,
          w2,
        ],
        level,
      ),
    ).toEqual({ kind: "consecutive-triples", size: 6, highRank: "J" });
  });

  it.each(SUPPORTED_PLAYER_COUNTS)(
    "keeps the opening-draw winner in control when leading a two-wildcard hand at a %i-player table",
    (playerCount) => {
      const opening = createTableRoundState(
        createDeck(playerCount),
        playerCount,
        fixedRandom,
      );
      const playing = completeTableOpeningDraw(opening);
      const winnerSeat = playing.openingDraw.winnerSeat;
      if (winnerSeat === null || playing.trick === null) {
        throw new Error("opening draw must produce a playing leader");
      }

      const cards: readonly Card[] = [
        suited("9"),
        suited("9", "spades"),
        wild("6"),
        wild("6"),
      ];
      const next = playTableCardsWithLevel(playing, winnerSeat, cards, "6");

      expect(next.phase).toBe("playing");
      expect(next.trick?.leadingPlay?.seat).toBe(winnerSeat);
      expect(next.trick?.leadingPlay?.hand).toEqual({
        kind: "bomb",
        size: 4,
        rank: "9",
      });
      expect(next.trick?.currentTurn).toBe((winnerSeat + 1) % playerCount);
      expect(next.openingDraw.winnerSeat).toBe(winnerSeat);
    },
  );
});
