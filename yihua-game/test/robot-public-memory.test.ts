import { describe, expect, it } from "vitest";
import { createDeck } from "../src/core/deck.js";
import {
  createPublicCardMemory,
  observePublicCards,
  unseenPublicCopies,
} from "../src/core/robot-public-memory.js";

describe("Master3 public-only robot card memory", () => {
  it("starts with zero observations and two unseen copies per face at four seats", () => {
    const deck = createDeck(4);
    const memory = createPublicCardMemory(4);
    expect(memory.revealedIds.size).toBe(0);
    expect(unseenPublicCopies(memory, deck[0]!.card)).toBe(2);
  });

  it("tracks both physical copies without counting replayed public events twice", () => {
    const deck = createDeck(4);
    const first = deck[0]!;
    const second = deck.find(
      (candidate) =>
        candidate.copy === 1 &&
        candidate.card.kind === "suited" &&
        first.card.kind === "suited" &&
        candidate.card.rank === first.card.rank &&
        candidate.card.suit === first.card.suit,
    )!;
    const initial = createPublicCardMemory(4);
    const one = observePublicCards(initial, [first]);
    const replay = observePublicCards(one, [first]);
    const both = observePublicCards(replay, [second]);
    expect(initial.revealedIds.size).toBe(0);
    expect(replay.revealedIds.size).toBe(1);
    expect(unseenPublicCopies(one, first.card)).toBe(1);
    expect(unseenPublicCopies(both, first.card)).toBe(0);
  });

  it("handles joker faces and the larger deck for six players", () => {
    const jokers = createDeck(6).filter(
      ({ card }) => card.kind === "joker" && card.size === "big",
    );
    expect(jokers).toHaveLength(3);
    const memory = observePublicCards(createPublicCardMemory(6), jokers);
    expect(unseenPublicCopies(memory, jokers[0]!.card)).toBe(0);
  });

  it("rejects forged card identities and out-of-range copies", () => {
    const card = createDeck(4)[0]!;
    const initial = createPublicCardMemory(4);
    expect(() =>
      observePublicCards(initial, [{ ...card, id: "0:fake:rank" }]),
    ).toThrow("identity");
    expect(() =>
      observePublicCards(initial, [{ ...card, copy: 2, id: "2:clubs:2" }]),
    ).toThrow("outside");
    expect(initial.revealedIds.size).toBe(0);
  });

  it("rejects a mixed valid and forged public batch atomically", () => {
    const deck = createDeck(4);
    const valid = deck[0]!;
    const forged = { ...deck[1]!, id: "0:forged:card" };
    const before = observePublicCards(createPublicCardMemory(4), [deck[2]!]);
    expect(() => observePublicCards(before, [valid, forged])).toThrow("identity");
    expect(before.revealedIds.size).toBe(1);
    expect(before.revealedIds.has(valid.id)).toBe(false);
    expect(unseenPublicCopies(before, valid.card)).toBe(2);
  });

  it("resets between deals without carrying over public observations", () => {
    const card = createDeck(4)[0]!;
    const previous = observePublicCards(createPublicCardMemory(4), [card]);
    const next = createPublicCardMemory(4);
    expect(unseenPublicCopies(previous, card.card)).toBe(1);
    expect(unseenPublicCopies(next, card.card)).toBe(2);
  });
});
