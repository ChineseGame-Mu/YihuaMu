import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  passGameTurn,
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
  leaderSeat = 0,
  finishedSeats: readonly number[] = [],
): PlayingState => ({
  phase: "playing",
  config: createTableConfig(4, 0),
  openingDraw: { attempts: [], winnerSeat: leaderSeat },
  hands,
  currentTurn: leaderSeat,
  trick: createTrickState(4, leaderSeat),
  finishedSeats,
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

  it("records a seat that plays its final card without ending the round", () => {
    const ace = suited("A", "spades");
    const state = playingState([
      [deckCard("0:spades:A", ace)],
      [deckCard("0:clubs:3", suited("3", "clubs"))],
      [deckCard("0:clubs:4", suited("4", "clubs"))],
      [deckCard("0:clubs:5", suited("5", "clubs"))],
    ]);

    const finished = playGameCards(state, 0, [ace]);

    expect(finished.phase).toBe("playing");
    expect(finished.finishedSeats).toEqual([0]);
    expect(finished.hands[0]).toHaveLength(0);
  });

  it("gives the lead to player 4 after player 2 finishes and both opponents pass", () => {
    const eight = suited("8", "clubs");
    const state = playingState(
      [
        [deckCard("0:clubs:3", suited("3", "clubs"))],
        [deckCard("0:clubs:8", eight)],
        [deckCard("0:clubs:4", suited("4", "clubs"))],
        [deckCard("0:clubs:5", suited("5", "clubs"))],
      ],
      1,
    );

    const afterFinal = playGameCards(state, 1, [eight]);
    expect(afterFinal.phase).toBe("playing");
    if (afterFinal.phase !== "playing")
      throw new Error("round ended too early");
    expect(afterFinal.finishedSeats).toEqual([1]);
    expect(afterFinal.currentTurn).toBe(2);

    const afterPlayer3Pass = passGameTurn(afterFinal, 2);
    expect(afterPlayer3Pass.currentTurn).toBe(0);

    const afterPlayer1Pass = passGameTurn(afterPlayer3Pass, 0);
    expect(afterPlayer1Pass.trick.leadingPlay).toBeNull();
    expect(afterPlayer1Pass.currentTurn).toBe(3);
    expect(afterPlayer1Pass.trick.leaderSeat).toBe(3);
  });

  it("keeps the lead with an opponent who beats a finished player's final card", () => {
    const eight = suited("8", "clubs");
    const nine = suited("9", "clubs");
    const state = playingState(
      [
        [deckCard("0:clubs:3", suited("3", "clubs"))],
        [deckCard("0:clubs:8", eight)],
        [
          deckCard("0:clubs:9", nine),
          deckCard("0:clubs:4", suited("4", "clubs")),
        ],
        [deckCard("0:clubs:5", suited("5", "clubs"))],
      ],
      1,
    );

    const afterFinal = playGameCards(state, 1, [eight]);
    if (afterFinal.phase !== "playing") throw new Error("round ended too early");
    const afterBeat = playGameCards(afterFinal, 2, [nine]);
    if (afterBeat.phase !== "playing") throw new Error("round ended too early");
    expect(afterBeat.trick.leadingPlay?.seat).toBe(2);

    const afterPlayer4Pass = passGameTurn(afterBeat, 3);
    const afterPlayer1Pass = passGameTurn(afterPlayer4Pass, 0);
    expect(afterPlayer1Pass.trick.leadingPlay).toBeNull();
    expect(afterPlayer1Pass.currentTurn).toBe(2);
    expect(afterPlayer1Pass.trick.leaderSeat).toBe(2);
  });

  it("never schedules a finished seat for a later turn", () => {
    const eight = suited("8", "clubs");
    const state = playingState(
      [
        [deckCard("0:clubs:3", suited("3", "clubs"))],
        [deckCard("0:clubs:8", eight)],
        [deckCard("0:clubs:4", suited("4", "clubs"))],
        [deckCard("0:clubs:5", suited("5", "clubs"))],
      ],
      1,
    );

    const afterFinal = playGameCards(state, 1, [eight]);
    if (afterFinal.phase !== "playing") throw new Error("round ended too early");
    expect(afterFinal.finishedSeats).toEqual([1]);
    expect(afterFinal.currentTurn).toBe(2);

    const afterPlayer3Pass = passGameTurn(afterFinal, 2);
    expect(afterPlayer3Pass.currentTurn).toBe(0);
  });

  it("completes the round once the remaining last place is determined", () => {
    const six = suited("6", "clubs");
    const state = playingState(
      [
        [],
        [],
        [deckCard("0:clubs:6", six)],
        [deckCard("0:clubs:7", suited("7", "clubs"))],
      ],
      2,
      [0, 1],
    );

    const completed = playGameCards(state, 2, [six]);
    expect(completed.phase).toBe("round-complete");
    if (completed.phase !== "round-complete") {
      throw new Error("expected round completion");
    }
    expect(completed.winnerSeat).toBe(0);
    expect(completed.finishedSeats).toEqual([0, 1, 2, 3]);
  });
});
