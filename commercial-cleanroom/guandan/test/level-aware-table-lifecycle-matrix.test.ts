import { describe, expect, it } from "vitest";
import type { Card, Rank } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  advanceTableOpeningDraw,
  createTableRoundState,
  passTableTurn,
  playTableCardsWithLevel,
} from "../src/core/table-state-machine.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const levelRank: Rank = "9";

const suited = (
  id: string,
  rank: Rank,
  suit: "clubs" | "diamonds" | "spades" | "hearts" = "clubs",
): DeckCard => ({ id, copy: 0, card: { kind: "suited", rank, suit } });

const openingDeck = (playerCount: SupportedPlayerCount): DeckCard[] => [
  suited("opening-ace", "A", "hearts"),
  ...Array.from({ length: playerCount - 1 }, (_, seat) =>
    suited(`opening-${seat + 1}`, seat % 2 === 0 ? "3" : "4"),
  ),
];

const cards = (...values: Card[]): readonly Card[] => values;
const c = (
  rank: Rank,
  suit: "clubs" | "diamonds" | "spades" | "hearts" = "clubs",
): Card => ({ kind: "suited", rank, suit });

describe("level-aware table lifecycle matrix", () => {
  it.each([4, 6, 8, 10, 12, 14] as const)(
    "keeps wildcard classification and active-seat rotation coherent for %i players",
    (playerCount) => {
      let state = advanceTableOpeningDraw(
        createTableRoundState(
          openingDeck(playerCount),
          playerCount,
          () => 0.999999,
        ),
      );

      expect(state.openingDraw.winnerSeat).toBe(0);
      expect(state.trick?.currentTurn).toBe(0);

      state = playTableCardsWithLevel(
        state,
        0,
        cards(c("7"), c(levelRank, "hearts")),
        levelRank,
        { finishesHand: true },
      );

      expect(state.finishingOrder).toEqual([0]);
      expect(state.activeSeats).not.toContain(0);
      expect(state.trick?.leadingPlay?.hand).toMatchObject({
        kind: "pair",
        rank: "7",
        size: 2,
      });
      expect(state.trick?.currentTurn).toBe(1);

      const opponents = Array.from(
        { length: playerCount / 2 },
        (_, index) => 1 + index * 2,
      );
      for (const seat of opponents) {
        expect(state.trick?.currentTurn).toBe(seat);
        state = passTableTurn(state, seat);
      }

      expect(state.phase).toBe("playing");
      expect(state.trick?.leadingPlay).toBeNull();
      expect(state.trick?.completedTricks).toBe(1);
      expect(state.trick?.leaderSeat).toBe(2);
      expect(state.trick?.currentTurn).toBe(2);
      expect(state.finishingOrder).toEqual([0]);
      expect(state.activeSeats).toEqual(
        Array.from({ length: playerCount - 1 }, (_, index) => index + 1),
      );
    },
  );

  it("lets a wildcard-completed bomb win a live table trick", () => {
    let state = advanceTableOpeningDraw(
      createTableRoundState(openingDeck(4), 4, () => 0.999999),
    );

    state = playTableCardsWithLevel(state, 0, cards(c("5")), levelRank);
    state = playTableCardsWithLevel(
      state,
      1,
      cards(
        c("8"),
        c("8", "diamonds"),
        c("8", "spades"),
        c(levelRank, "hearts"),
      ),
      levelRank,
    );

    expect(state.trick?.leadingPlay?.seat).toBe(1);
    expect(state.trick?.leadingPlay?.hand).toMatchObject({
      kind: "bomb",
      rank: "8",
      size: 4,
    });
    expect(state.trick?.currentTurn).toBe(2);
  });
});
