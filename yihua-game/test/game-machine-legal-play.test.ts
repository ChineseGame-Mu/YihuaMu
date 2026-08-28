import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import { transitionGame } from "../src/core/game-machine.js";
import type { PlayingState } from "../src/core/game-state.js";
import { createTableConfig } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});

const deckCard = (id: string, card: Card): DeckCard => ({ id, copy: 0, card });

const stateWithHands = (
  hands: readonly (readonly DeckCard[])[],
): PlayingState => ({
  phase: "playing",
  config: createTableConfig(4, 0),
  openingDraw: { attempts: [], winnerSeat: 0 },
  hands,
  currentTurn: 0,
  trick: createTrickState(4, 0),
  finishedSeats: [],
});

const expectPlaying = (
  state: ReturnType<typeof transitionGame>,
): PlayingState => {
  expect(state.phase).toBe("playing");
  if (state.phase !== "playing") throw new Error("expected playing state");
  return state;
};

describe("table machine legal-play enforcement", () => {
  it("rejects a lower response and accepts a higher same-type response", () => {
    const pair8 = [suited("8", "clubs"), suited("8", "hearts")];
    const pair7 = [suited("7", "clubs"), suited("7", "hearts")];
    const pair9 = [suited("9", "clubs"), suited("9", "hearts")];
    const state = stateWithHands([
      [
        deckCard("lead-8c", pair8[0]!),
        deckCard("lead-8h", pair8[1]!),
        deckCard("lead-extra", suited("3", "clubs")),
      ],
      [
        deckCard("low-7c", pair7[0]!),
        deckCard("low-7h", pair7[1]!),
        deckCard("high-9c", pair9[0]!),
        deckCard("high-9h", pair9[1]!),
      ],
      [deckCard("seat2", suited("4", "clubs"))],
      [deckCard("seat3", suited("5", "clubs"))],
    ]);

    const afterLead = expectPlaying(
      transitionGame(state, {
        type: "play-cards",
        seat: 0,
        cards: pair8,
      }),
    );
    expect(afterLead.trick.leadingPlay?.seat).toBe(0);

    expect(() =>
      transitionGame(afterLead, { type: "play-cards", seat: 1, cards: pair7 }),
    ).toThrow("played hand does not beat the current hand");

    const afterBeat = expectPlaying(
      transitionGame(afterLead, {
        type: "play-cards",
        seat: 1,
        cards: pair9,
      }),
    );
    expect(afterBeat.trick.leadingPlay?.seat).toBe(1);
  });

  it("allows a bomb over an ordinary hand and rejects an ordinary hand over a bomb", () => {
    const pairA = [suited("A", "clubs"), suited("A", "hearts")];
    const bomb3 = [
      suited("3", "clubs"),
      suited("3", "diamonds"),
      suited("3", "spades"),
      suited("3", "hearts"),
    ];
    const pair2 = [suited("2", "clubs"), suited("2", "hearts")];
    const state = stateWithHands([
      [
        deckCard("pair-ac", pairA[0]!),
        deckCard("pair-ah", pairA[1]!),
        deckCard("lead-extra", suited("4", "clubs")),
      ],
      [
        ...bomb3.map((card, index) => deckCard(`bomb-${index}`, card)),
        deckCard("bomb-extra", suited("5", "clubs")),
      ],
      [
        deckCard("pair-2c", pair2[0]!),
        deckCard("pair-2h", pair2[1]!),
        deckCard("seat2-extra", suited("6", "clubs")),
      ],
      [deckCard("seat3", suited("7", "clubs"))],
    ]);

    const afterLead = expectPlaying(
      transitionGame(state, {
        type: "play-cards",
        seat: 0,
        cards: pairA,
      }),
    );
    const afterBomb = expectPlaying(
      transitionGame(afterLead, {
        type: "play-cards",
        seat: 1,
        cards: bomb3,
      }),
    );
    expect(afterBomb.trick.leadingPlay?.hand.kind).toBe("bomb");

    expect(() =>
      transitionGame(afterBomb, { type: "play-cards", seat: 2, cards: pair2 }),
    ).toThrow("played hand does not beat the current hand");
  });

  it("enforces five-bomb, straight-flush, and six-bomb hierarchy in live table state", () => {
    const fiveBomb = [
      suited("3", "clubs"),
      suited("3", "diamonds"),
      suited("3", "hearts"),
      suited("3", "spades"),
      suited("3", "clubs"),
    ];
    const straightFlush = [
      suited("5", "hearts"),
      suited("6", "hearts"),
      suited("7", "hearts"),
      suited("8", "hearts"),
      suited("9", "hearts"),
    ];
    const sixBomb = [
      suited("4", "clubs"),
      suited("4", "diamonds"),
      suited("4", "hearts"),
      suited("4", "spades"),
      suited("4", "clubs"),
      suited("4", "diamonds"),
    ];
    const state = stateWithHands([
      [
        ...fiveBomb.map((card, index) => deckCard(`five-${index}`, card)),
        deckCard("seat0-extra", suited("A", "clubs")),
      ],
      [
        ...straightFlush.map((card, index) =>
          deckCard(`flush-${index}`, card),
        ),
        deckCard("seat1-extra", suited("A", "diamonds")),
      ],
      [
        ...sixBomb.map((card, index) => deckCard(`six-${index}`, card)),
        deckCard("seat2-extra", suited("A", "hearts")),
      ],
      [deckCard("seat3", suited("A", "spades"))],
    ]);

    const afterFiveBomb = expectPlaying(
      transitionGame(state, {
        type: "play-cards",
        seat: 0,
        cards: fiveBomb,
      }),
    );
    expect(afterFiveBomb.trick.leadingPlay?.hand).toMatchObject({
      kind: "bomb",
      size: 5,
    });

    const afterStraightFlush = expectPlaying(
      transitionGame(afterFiveBomb, {
        type: "play-cards",
        seat: 1,
        cards: straightFlush,
      }),
    );
    expect(afterStraightFlush.trick.leadingPlay?.hand.kind).toBe(
      "straight-flush",
    );

    const afterSixBomb = expectPlaying(
      transitionGame(afterStraightFlush, {
        type: "play-cards",
        seat: 2,
        cards: sixBomb,
      }),
    );
    expect(afterSixBomb.trick.leadingPlay?.hand).toMatchObject({
      kind: "bomb",
      size: 6,
    });
  });
});
