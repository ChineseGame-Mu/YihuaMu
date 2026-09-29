import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  advanceTableOpeningDraw,
  createTableRoundState,
  passTableTurn,
  playTableCards,
  startNextTableRound,
} from "../src/core/table-state-machine.js";

const card = (
  id: string,
  rank: "3" | "4" | "5" | "6" | "A",
  suit: "clubs" | "diamonds" | "spades" | "hearts" = "clubs",
): DeckCard => ({
  id,
  copy: 0,
  card: { kind: "suited", rank, suit },
});

const asCard = (deckCard: DeckCard): Card => deckCard.card;

const openingDeck = (): DeckCard[] => [
  card("0:a", "A", "hearts"),
  card("0:3", "3"),
  card("0:4", "4"),
  card("0:5", "5"),
  card("0:6", "6"),
];

describe("table state machine lifecycle", () => {
  it("moves from independent opening draw into play with the draw winner leading", () => {
    let state = createTableRoundState(openingDeck(), 4, () => 0.999999);

    expect(state.phase).toBe("opening-draw");
    expect(state.trick).toBeNull();

    state = advanceTableOpeningDraw(state);

    expect(state.phase).toBe("playing");
    expect(state.openingDraw.winnerSeat).toBe(0);
    expect(state.trick?.leaderSeat).toBe(0);
    expect(state.trick?.currentTurn).toBe(0);
    expect(state.activeSeats).toEqual([0, 1, 2, 3]);
  });

  it("tracks finishing order through round completion and restores all seats next round", () => {
    let state = advanceTableOpeningDraw(
      createTableRoundState(openingDeck(), 4, () => 0.999999),
    );

    state = playTableCards(state, 0, [asCard(card("p0", "3"))], {
      finishesHand: true,
    });
    state = playTableCards(state, 1, [asCard(card("p1", "4"))], {
      finishesHand: true,
    });
    state = playTableCards(state, 2, [asCard(card("p2", "5"))], {
      finishesHand: true,
    });

    expect(state.phase).toBe("round-complete");
    expect(state.finishingOrder).toEqual([0, 1, 2, 3]);
    expect(state.activeSeats).toEqual([3]);

    state = startNextTableRound(state);

    expect(state.phase).toBe("playing");
    expect(state.activeSeats).toEqual([0, 1, 2, 3]);
    expect(state.finishingOrder).toEqual([]);
    expect(state.trick?.leaderSeat).toBe(0);
    expect(state.trick?.currentTurn).toBe(0);
  });

  it("rejects play/pass before opening draw and rejects advancing after play begins", () => {
    const opening = createTableRoundState(openingDeck(), 4, () => 0.999999);

    expect(() => passTableTurn(opening, 0)).toThrow(
      "table is not in the playing phase",
    );
    expect(() => playTableCards(opening, 0, [asCard(card("p0", "3"))])).toThrow(
      "table is not in the playing phase",
    );

    const playing = advanceTableOpeningDraw(opening);
    expect(() => advanceTableOpeningDraw(playing)).toThrow(
      "opening draw is already complete",
    );
  });
});
