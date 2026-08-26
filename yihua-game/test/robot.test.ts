import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { createDeck, dealHands, type DeckCard } from "../src/core/deck.js";
import type { PlayingState } from "../src/core/game-state.js";
import { createTurnState, playCards } from "../src/core/play-state.js";
import {
  applyRobotTurn,
  chooseRobotTurn,
  robotDelayMs,
} from "../src/core/robot.js";
import { createTableConfig } from "../src/core/table.js";

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});
let serial = 0;
const deckCard = (card: Card): DeckCard => ({
  id: `robot-${serial++}`,
  copy: 0,
  card,
});
const playing = (hands: readonly (readonly DeckCard[])[]): PlayingState => ({
  phase: "playing",
  config: createTableConfig(4, 1),
  openingDraw: { attempts: [], winnerSeat: 0 },
  hands,
  currentTurn: 0,
});

describe("robot turns", () => {
  it("keeps the human-like delay inside the configured range", () => {
    expect(robotDelayMs(() => 0)).toBe(800);
    expect(robotDelayMs(() => 0.999)).toBeLessThanOrEqual(1800);
  });

  it("leads with a legal hand", () => {
    const cards = [
      deckCard(suited("9", "clubs")),
      deckCard(suited("K", "spades")),
    ];
    const state = createTurnState(playing([cards, [], [], []]), "7");
    const turn = chooseRobotTurn(state, 0);
    expect(turn.type).toBe("play");
    if (turn.type === "play") expect(turn.cardIds).toHaveLength(1);
  });

  it("finds a legal beating pair including a wildcard", () => {
    const kings = [
      deckCard(suited("K", "clubs")),
      deckCard(suited("K", "spades")),
    ];
    const response = [
      deckCard(suited("A", "clubs")),
      deckCard(suited("7", "hearts")),
    ];
    let state = createTurnState(playing([kings, response, [], []]), "7");
    state = playCards(
      state,
      0,
      kings.map(({ id }) => id),
    );
    const turn = chooseRobotTurn(state, 1);
    expect(turn.type).toBe("play");
    if (turn.type === "play") {
      expect(turn.declaredKind).toBe("pair");
      expect(new Set(turn.cardIds)).toEqual(
        new Set(response.map(({ id }) => id)),
      );
    }
  });

  it("passes when no legal response can beat the table", () => {
    const aces = [
      deckCard(suited("A", "clubs")),
      deckCard(suited("A", "spades")),
    ];
    const response = [
      deckCard(suited("9", "clubs")),
      deckCard(suited("9", "spades")),
    ];
    let state = createTurnState(playing([aces, response, [], []]), "7");
    state = playCards(
      state,
      0,
      aces.map(({ id }) => id),
    );
    expect(chooseRobotTurn(state, 1)).toEqual({ type: "pass" });
  });

  it("applies a robot play through the same turn state and records finishing", () => {
    const robotCard = deckCard(suited("9", "clubs"));
    const opponent = deckCard(suited("8", "clubs"));
    const state = createTurnState(
      playing([[robotCard], [opponent], [], []]),
      "7",
    );

    const next = applyRobotTurn(state, 0);
    expect(next.hands[0]).toHaveLength(0);
    expect(next.finishedSeats).toContain(0);
    expect(next.finishOrder).toEqual([0]);
    expect(next.publicActions.at(-1)?.type).toBe("play");
  });

  it("runs a complete four-robot 27-card game through the real turn state", () => {
    const hands = dealHands(createDeck(4), 4);
    let state = createTurnState(playing(hands), "7");
    let turns = 0;

    while (state.finishedSeats.length < 3 && turns < 2000) {
      state = applyRobotTurn(state, state.currentTurn);
      turns += 1;
    }

    expect(turns).toBeLessThan(2000);
    expect(state.finishedSeats.length).toBeGreaterThanOrEqual(3);
    expect(new Set(state.finishOrder).size).toBe(state.finishOrder.length);
    expect(state.finishOrder.length).toBeGreaterThanOrEqual(3);
    expect(state.hands.flat().length).toBeLessThanOrEqual(27);
  });
});
