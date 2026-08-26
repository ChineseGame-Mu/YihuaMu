import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  playGameCards,
  type PlayingState,
} from "../src/core/game-state.js";
import { createTableConfig } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});

const deckCard = (id: string, card: Card): DeckCard => ({
  id,
  copy: 0,
  card,
});

const playingState = (
  hands: readonly (readonly DeckCard[])[],
): PlayingState => ({
  phase: "playing",
  config: createTableConfig(4, 0),
  openingDraw: { attempts: [], winnerSeat: 0 },
  hands,
  currentTurn: 0,
  trick: createTrickState(4, 0),
});

describe("game-state owned-card play integration", () => {
  it("rejects a valid pattern when the current seat does not own the card", () => {
    const three = suited("3", "clubs");
    const four = suited("4", "clubs");
    const state = playingState([
      [deckCard("0:clubs:3", three)],
      [deckCard("0:clubs:4", four)],
      [],
      [],
    ]);

    expect(() => playGameCards(state, 0, [four])).toThrow(
      "played card is not in seat's hand",
    );
    expect(state.hands[0]).toHaveLength(1);
  });

  it("removes each successfully played card from the seat hand", () => {
    const three = suited("3", "clubs");
    const four = suited("4", "clubs");
    const state = playingState([
      [deckCard("0:clubs:3", three), deckCard("0:clubs:4", four)],
      [],
      [],
      [],
    ]);

    const next = playGameCards(state, 0, [three]);

    expect(next.phase).toBe("playing");
    expect(next.hands[0]).toHaveLength(1);
    expect(next.hands[0]?.[0]?.card).toEqual(four);
    expect(next.currentTurn).toBe(1);
  });

  it("keeps hand-pattern comparison active while enforcing ownership", () => {
    const pair8 = [suited("8", "clubs"), suited("8", "hearts")];
    const pair7 = [suited("7", "clubs"), suited("7", "hearts")];
    const pair9 = [suited("9", "clubs"), suited("9", "hearts")];
    const state = playingState([
      [
        deckCard("0:clubs:8", pair8[0]!),
        deckCard("0:hearts:8", pair8[1]!),
        deckCard("0:clubs:2", suited("2", "clubs")),
      ],
      [
        deckCard("0:clubs:7", pair7[0]!),
        deckCard("0:hearts:7", pair7[1]!),
        deckCard("0:clubs:9", pair9[0]!),
        deckCard("0:hearts:9", pair9[1]!),
      ],
      [],
      [],
    ]);

    const afterLead = playGameCards(state, 0, pair8);
    expect(afterLead.phase).toBe("playing");
    if (afterLead.phase !== "playing") throw new Error("round ended too early");

    expect(() => playGameCards(afterLead, 1, pair7)).toThrow(
      "played hand does not beat the current hand",
    );

    const afterBeat = playGameCards(afterLead, 1, pair9);
    expect(afterBeat.phase).toBe("playing");
    expect(afterBeat.hands[1]).toHaveLength(2);
    expect(afterBeat.trick.leadingPlay?.seat).toBe(1);
  });

  it("marks the round complete when a seat plays its final owned card", () => {
    const ace = suited("A", "spades");
    const state = playingState([
      [deckCard("0:spades:A", ace)],
      [],
      [],
      [],
    ]);

    const finished = playGameCards(state, 0, [ace]);

    expect(finished.phase).toBe("round-complete");
    if (finished.phase !== "round-complete") {
      throw new Error("expected round completion");
    }
    expect(finished.winnerSeat).toBe(0);
    expect(finished.hands[0]).toHaveLength(0);
  });
});
