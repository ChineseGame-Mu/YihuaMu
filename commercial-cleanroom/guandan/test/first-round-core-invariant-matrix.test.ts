import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { transitionGame } from "../src/core/game-machine.js";
import { createLobbyState } from "../src/core/game-state.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";
import {
  createTrickState,
  passTurn,
  playCards,
} from "../src/core/trick-state.js";

const suited = (suit: Suit, rank: Rank): Card => ({
  kind: "suited",
  suit,
  rank,
});
const deterministicRandom = (): number => 0;

describe("first-round clean-room core invariants", () => {
  for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
    it(`keeps opening draw independent and hands first lead to its winner at ${playerCount} seats`, () => {
      const lobby = createLobbyState(playerCount, 0);
      const opening = transitionGame(
        lobby,
        { type: "begin-opening-draw" },
        deterministicRandom,
      );

      expect(opening.phase).toBe("opening-draw");
      if (opening.phase !== "opening-draw")
        throw new Error("expected opening draw");
      expect(opening.openingDraw.attempts.length).toBeGreaterThan(0);
      expect(
        opening.openingDraw.attempts.every((attempt) =>
          attempt.cards.every(({ card }) => card.kind === "suited"),
        ),
      ).toBe(true);

      const playing = transitionGame(
        opening,
        { type: "deal-after-opening-draw" },
        deterministicRandom,
      );
      expect(playing.phase).toBe("playing");
      if (playing.phase !== "playing")
        throw new Error("expected playing state");
      expect(playing.hands).toHaveLength(playerCount);
      expect(playing.hands.every((hand) => hand.length === 27)).toBe(true);
      expect(playing.currentTurn).toBe(opening.openingDraw.winnerSeat);
      expect(playing.trick.leaderSeat).toBe(opening.openingDraw.winnerSeat);
    });
  }

  it("locks sequence edges and bomb escalation into the hand classifier", () => {
    const aceLowStraight = classifyHand([
      suited("clubs", "A"),
      suited("diamonds", "2"),
      suited("hearts", "3"),
      suited("spades", "4"),
      suited("clubs", "5"),
    ]);
    const wrappedStraight = classifyHand([
      suited("clubs", "J"),
      suited("diamonds", "Q"),
      suited("hearts", "K"),
      suited("spades", "A"),
      suited("clubs", "2"),
    ]);
    const fiveBomb = classifyHand(
      Array.from({ length: 5 }, () => suited("clubs", "9")),
    );
    const straightFlush = classifyHand([
      suited("hearts", "6"),
      suited("hearts", "7"),
      suited("hearts", "8"),
      suited("hearts", "9"),
      suited("hearts", "10"),
    ]);
    const sixBomb = classifyHand(
      Array.from({ length: 6 }, () => suited("diamonds", "3")),
    );
    const jokerBomb = classifyHand([
      { kind: "joker", size: "small" },
      { kind: "joker", size: "small" },
      { kind: "joker", size: "big" },
      { kind: "joker", size: "big" },
    ]);

    expect(aceLowStraight.kind).toBe("straight");
    expect(aceLowStraight.highRank).toBe("5");
    expect(wrappedStraight.kind).toBe("invalid");
    expect(canHandBeat(straightFlush, fiveBomb)).toBe(true);
    expect(canHandBeat(sixBomb, straightFlush)).toBe(true);
    expect(canHandBeat(jokerBomb, sixBomb)).toBe(true);
  });

  for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
    it(`returns a completed trick to the surviving rotation when the leader has finished at ${playerCount} seats`, () => {
      const activeSeats = Array.from(
        { length: playerCount - 1 },
        (_, index) => index + 1,
      );
      let state = createTrickState(playerCount, 0);
      state = playCards(state, 0, [suited("clubs", "7")], [0, ...activeSeats]);

      for (const seat of activeSeats) {
        state = passTurn(state, seat, activeSeats);
      }

      expect(state.leadingPlay).toBeNull();
      expect(activeSeats).toContain(state.currentTurn);
      expect(state.currentTurn).toBe(1);
      expect(state.leaderSeat).toBe(1);
      expect(state.completedTricks).toBe(1);
    });
  }
});
