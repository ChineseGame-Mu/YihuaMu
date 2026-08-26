import assert from "node:assert/strict";
import test from "node:test";
import type { Card } from "../src/core/cards.js";
import { createTrickState, passTurn, playCards } from "../src/core/trick-state.js";

const card = (rank: "3" | "4" | "5", suit: "clubs" | "diamonds" = "clubs"): Card => ({
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

test("pass is recorded and turn wraps around table", () => {
  const played = playCards(createTrickState(4, 3), 3, [card("4")]);
  const passed = passTurn(played, 0);
  assert.deepEqual(passed.passedSeats, [0]);
  assert.equal(passed.currentTurn, 1);
});

test("leader cannot pass before a play", () => {
  assert.throws(() => passTurn(createTrickState(4, 0), 0), /leader cannot pass/);
});

test("out-of-turn and invalid plays are rejected", () => {
  const state = createTrickState(4, 0);
  assert.throws(() => playCards(state, 1, [card("3")]), /not this seat's turn/);
  assert.throws(
    () => playCards(state, 0, [card("3"), card("4"), card("5"), card("3", "diamonds")]),
    /invalid hand/,
  );
});
