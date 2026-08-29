import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";
import {
  advanceTableOpeningDraw,
  createTableRoundState,
  passTableTurn,
  playTableCards,
} from "../src/core/table-state-machine.js";

const suitedCard = (suit: Suit, rank: Rank): Card => ({
  kind: "suited",
  suit,
  rank,
});

const deckCard = (id: string, suit: Suit, rank: Rank): DeckCard => ({
  id,
  copy: 0,
  card: suitedCard(suit, rank),
});

const ranks = (values: readonly Rank[], suit: Suit = "clubs"): Card[] =>
  values.map((rank) => suitedCard(suit, rank));

const repeated = (rank: Rank, count: number): Card[] =>
  Array.from({ length: count }, (_, index) =>
    suitedCard(index % 2 === 0 ? "clubs" : "diamonds", rank),
  );

describe("complete Guandan hand classification coverage", () => {
  it("classifies every standard non-wildcard hand family", () => {
    expect(classifyHand(ranks(["7"])).kind).toBe("single");
    expect(classifyHand(repeated("7", 2)).kind).toBe("pair");
    expect(classifyHand(repeated("7", 3)).kind).toBe("triple");
    expect(classifyHand([...repeated("7", 3), ...repeated("8", 2)]).kind).toBe(
      "full-house",
    );
    expect(classifyHand(ranks(["7", "8", "9", "10", "J"])).kind).toBe(
      "straight-flush",
    );
    expect(
      classifyHand([
        suitedCard("clubs", "7"),
        suitedCard("diamonds", "8"),
        suitedCard("clubs", "9"),
        suitedCard("diamonds", "10"),
        suitedCard("clubs", "J"),
      ]).kind,
    ).toBe("straight");
    expect(
      classifyHand([
        ...repeated("7", 2),
        ...repeated("8", 2),
        ...repeated("9", 2),
      ]).kind,
    ).toBe("consecutive-pairs");
    expect(
      classifyHand([...repeated("7", 3), ...repeated("8", 3)]).kind,
    ).toBe("consecutive-triples");
    expect(classifyHand(repeated("9", 4)).kind).toBe("bomb");
    expect(
      classifyHand([
        { kind: "joker", size: "small" },
        { kind: "joker", size: "small" },
        { kind: "joker", size: "big" },
        { kind: "joker", size: "big" },
      ]).kind,
    ).toBe("joker-bomb");
  });

  it("preserves Guandan bomb hierarchy across ordinary hands", () => {
    const straightFlush = classifyHand(ranks(["7", "8", "9", "10", "J"]));
    const fiveBomb = classifyHand(repeated("9", 5));
    const sixBomb = classifyHand(repeated("7", 6));
    const jokerBomb = classifyHand([
      { kind: "joker", size: "small" },
      { kind: "joker", size: "small" },
      { kind: "joker", size: "big" },
      { kind: "joker", size: "big" },
    ]);

    expect(canHandBeat(straightFlush, fiveBomb)).toBe(true);
    expect(canHandBeat(sixBomb, straightFlush)).toBe(true);
    expect(canHandBeat(jokerBomb, sixBomb)).toBe(true);
  });
});

describe("clean-room table round state machine", () => {
  it("runs opening draw through play, pass, finish, and round completion", () => {
    const deck: DeckCard[] = [
      deckCard("a", "hearts", "A"),
      deckCard("8", "clubs", "8"),
      deckCard("9", "diamonds", "9"),
      deckCard("7", "spades", "7"),
    ];

    let state = createTableRoundState(deck, 4, () => 0.999999);
    expect(state.phase).toBe("opening-draw");
    expect(state.trick).toBeNull();

    state = advanceTableOpeningDraw(state);
    expect(state.phase).toBe("playing");
    expect(state.openingDraw.winnerSeat).toBe(0);
    expect(state.trick?.currentTurn).toBe(0);

    state = playTableCards(state, 0, ranks(["7"]), {
      finishesHand: true,
    });
    expect(state.finishingOrder).toEqual([0]);
    expect(state.activeSeats).toEqual([1, 2, 3]);
    expect(state.trick?.currentTurn).toBe(1);

    state = playTableCards(state, 1, ranks(["8"]), {
      finishesHand: true,
    });
    expect(state.finishingOrder).toEqual([0, 1]);
    expect(state.activeSeats).toEqual([2, 3]);

    state = passTableTurn(state, 2);
    state = passTableTurn(state, 3);
    expect(state.trick?.leadingPlay).toBeNull();
    expect(state.trick?.currentTurn).toBe(2);
    expect(state.trick?.completedTricks).toBe(1);

    state = playTableCards(state, 2, ranks(["9"]), {
      finishesHand: true,
    });
    expect(state.phase).toBe("round-complete");
    expect(state.finishingOrder).toEqual([0, 1, 2, 3]);
    expect(state.activeSeats).toEqual([3]);
    expect(() => passTableTurn(state, 3)).toThrow(
      "table is not in the playing phase",
    );
  });
});
