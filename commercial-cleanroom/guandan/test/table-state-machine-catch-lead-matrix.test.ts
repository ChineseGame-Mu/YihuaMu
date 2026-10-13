import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  advanceTableOpeningDraw,
  createTableRoundState,
  passTableTurn,
  playTableCards,
} from "../src/core/table-state-machine.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const deckCard = (
  id: string,
  rank: "3" | "4" | "5" | "6" | "A",
  suit: "clubs" | "diamonds" | "spades" | "hearts" = "clubs",
): DeckCard => ({
  id,
  copy: 0,
  card: { kind: "suited", rank, suit },
});

const asCard = (value: DeckCard): Card => value.card;

const openingDeck = (playerCount: SupportedPlayerCount): DeckCard[] => [
  deckCard("winner", "A", "hearts"),
  ...Array.from({ length: playerCount - 1 }, (_, seat) =>
    deckCard(`draw-${seat + 1}`, "3"),
  ),
];

const start = (playerCount: SupportedPlayerCount) =>
  advanceTableOpeningDraw(
    createTableRoundState(
      openingDeck(playerCount),
      playerCount,
      () => 0.999999,
    ),
  );

describe("table state machine catch lead", () => {
  it.each([4, 6, 8, 10, 12, 14] as const)(
    "skips teammates while opponents answer a finished leader for %i players",
    (playerCount) => {
      let state = playTableCards(
        start(playerCount),
        0,
        [asCard(deckCard("lead", "3"))],
        { finishesHand: true },
      );

      expect(state.finishingOrder).toEqual([0]);
      expect(state.trick?.currentTurn).toBe(1);

      const opponents = Array.from(
        { length: playerCount / 2 },
        (_, index) => 1 + index * 2,
      );
      for (const seat of opponents) {
        expect(state.trick?.currentTurn).toBe(seat);
        state = passTableTurn(state, seat);
      }

      expect(state.trick?.leadingPlay).toBeNull();
      expect(state.trick?.leaderSeat).toBe(2);
      expect(state.trick?.currentTurn).toBe(2);
      expect(state.trick?.completedTricks).toBe(1);
      expect(state.activeSeats.includes(0)).toBe(false);
    },
  );

  it("lets the catching teammate start a fresh trick without an extra pass", () => {
    let state = playTableCards(start(4), 0, [asCard(deckCard("lead", "3"))], {
      finishesHand: true,
    });
    state = passTableTurn(state, 1);
    state = passTableTurn(state, 3);

    state = playTableCards(state, 2, [asCard(deckCard("catch", "4"))]);

    expect(state.trick?.leadingPlay?.seat).toBe(2);
    expect(state.trick?.leaderSeat).toBe(2);
    expect(state.trick?.currentTurn).toBe(3);
    expect(state.trick?.passedSeats).toEqual([]);
  });
});
