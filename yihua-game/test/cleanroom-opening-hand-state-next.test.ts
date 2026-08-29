import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";
import { runOpeningDraw } from "../src/core/opening-draw.js";
import {
  createTrickState,
  passTurn,
  playCards,
} from "../src/core/trick-state.js";

const suited = (
  id: string,
  copy: number,
  suit: "clubs" | "diamonds" | "spades" | "hearts",
  rank: "7" | "8" | "9" | "A",
): DeckCard => ({ id, copy, card: { kind: "suited", suit, rank } });

const joker = (
  id: string,
  copy: number,
  size: "small" | "big",
): DeckCard => ({ id, copy, card: { kind: "joker", size } });

const single = (rank: "7" | "8" | "9"): Card => ({
  kind: "suited",
  suit: "clubs",
  rank,
});

const jokerCard = (size: "small" | "big"): Card => ({
  kind: "joker",
  size,
});

describe("clean-room opening, hand, and table-state next step", () => {
  it("retries a tied opening draw without consuming jokers and preserves seat mapping", () => {
    const deck: DeckCard[] = [
      suited("0:a", 0, "hearts", "A"),
      suited("1:a", 1, "hearts", "A"),
      suited("0:7", 0, "clubs", "7"),
      suited("0:8", 0, "clubs", "8"),
      joker("0:joker", 0, "big"),
      suited("1:7", 1, "clubs", "7"),
      suited("1:8", 1, "diamonds", "8"),
      suited("1:a2", 1, "spades", "A"),
      suited("1:9", 1, "hearts", "9"),
    ];

    const result = runOpeningDraw(deck, 4, () => 0.999999);

    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]!.winnerSeat).toBeNull();
    expect(result.attempts[1]!.winnerSeat).toBe(2);
    expect(result.winnerSeat).toBe(2);
    expect(result.attempts.flatMap((attempt) => attempt.cards)).not.toContain(
      deck[4],
    );
    expect(result.attempts[1]!.seatDraws.map(({ seat }) => seat)).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it("classifies same-size joker pairs and orders big pair above small pair", () => {
    const smallPair = classifyHand([jokerCard("small"), jokerCard("small")]);
    const bigPair = classifyHand([jokerCard("big"), jokerCard("big")]);
    const mixedPair = classifyHand([jokerCard("small"), jokerCard("big")]);

    expect(smallPair).toMatchObject({
      kind: "pair",
      size: 2,
      jokerSize: "small",
    });
    expect(bigPair).toMatchObject({ kind: "pair", size: 2, jokerSize: "big" });
    expect(mixedPair.kind).toBe("invalid");
    expect(canHandBeat(bigPair, smallPair)).toBe(true);
    expect(canHandBeat(smallPair, bigPair)).toBe(false);
  });

  it("drops passes from seats that leave the active rotation before quorum", () => {
    let state = createTrickState(4, 0);
    state = playCards(state, 0, [single("7")], [0, 1, 2, 3]);
    state = passTurn(state, 1, [0, 1, 2, 3]);

    expect(state.passedSeats).toEqual([1]);
    expect(state.currentTurn).toBe(2);

    state = passTurn(state, 2, [0, 2, 3]);
    expect(state.leadingPlay).not.toBeNull();
    expect(state.passedSeats).toEqual([2]);
    expect(state.currentTurn).toBe(3);

    state = passTurn(state, 3, [0, 2, 3]);
    expect(state.leadingPlay).toBeNull();
    expect(state.completedTricks).toBe(1);
    expect(state.currentTurn).toBe(0);
  });
});
