import assert from "node:assert/strict";
import test from "node:test";
import type { Card } from "../src/core/cards.js";
import {
  createTrickState,
  passTurn,
  playCards,
} from "../src/core/trick-state.js";

const card = (
  rank: "3" | "4" | "5" | "6" | "7" | "8" | "9",
  suit: "clubs" | "diamonds" | "hearts" | "spades" = "clubs",
): Card => ({
  kind: "suited",
  rank,
  suit,
});

test("trick starts with opening leader and no table play", () => {
  const state = createTrickState(4, 2);
  assert.equal(state.currentTurn, 2);
  assert.equal(state.leadingPlay, null);
});

test("valid play becomes visible table leader and advances turn", () => {
  const state = playCards(createTrickState(4, 2), 2, [card("3")]);
  assert.equal(state.leadingPlay?.seat, 2);
  assert.equal(state.leadingPlay?.hand.kind, "single");
  assert.equal(state.currentTurn, 3);
  assert.equal(state.plays.length, 1);
});

test("a response must beat the current hand", () => {
  let state = playCards(createTrickState(4, 0), 0, [card("5")]);
  assert.throws(
    () => playCards(state, 1, [card("4")]),
    /does not beat the current hand/,
  );
  state = playCards(state, 1, [card("6")]);
  assert.equal(state.leadingPlay?.seat, 1);
  assert.equal(state.leadingPlay?.hand.rank, "6");
});

test("a bomb can beat an ordinary hand", () => {
  let state = playCards(createTrickState(4, 0), 0, [card("9")]);
  state = playCards(state, 1, [
    card("3", "clubs"),
    card("3", "diamonds"),
    card("3", "hearts"),
    card("3", "spades"),
  ]);
  assert.equal(state.leadingPlay?.hand.kind, "bomb");
});

test("three passes clear a four-player trick and return the lead to the winner", () => {
  let state = playCards(createTrickState(4, 3), 3, [card("4")]);
  state = passTurn(state, 0);
  state = passTurn(state, 1);
  state = passTurn(state, 2);

  assert.equal(state.leadingPlay, null);
  assert.deepEqual(state.passedSeats, []);
  assert.equal(state.currentTurn, 3);
  assert.equal(state.leaderSeat, 3);
});

test("leader cannot pass before a play", () => {
  assert.throws(
    () => passTurn(createTrickState(4, 0), 0),
    /leader cannot pass/,
  );
});

test("out-of-turn and invalid plays are rejected", () => {
  const state = createTrickState(4, 0);
  assert.throws(() => playCards(state, 1, [card("3")]), /not this seat's turn/);
  assert.throws(
    () =>
      playCards(state, 0, [
        card("3"),
        card("4"),
        card("5"),
        card("3", "diamonds"),
      ]),
    /invalid hand/,
  );
});
