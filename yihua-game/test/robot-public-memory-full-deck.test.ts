import { describe, expect, it } from "vitest";
import { createDeck } from "../src/core/deck.js";
import {
  createPublicCardMemory,
  observePublicCards,
  unseenPublicCopies,
} from "../src/core/robot-public-memory.js";

describe("Master3 public-memory full-deck invariants", () => {
  it("accounts for all 108 publicly revealed physical cards exactly once", () => {
    const deck = createDeck(4);
    expect(deck).toHaveLength(108);
    const original = createPublicCardMemory(4);
    let memory = original;
    for (const card of deck) {
      memory = observePublicCards(memory, [card, card]);
    }
    expect(original.revealedIds.size).toBe(0);
    expect(memory.revealedIds.size).toBe(108);
    expect([...memory.revealedByFace.values()].every((count) => count === 2)).toBe(true);
    for (const { card } of deck) {
      expect(unseenPublicCopies(memory, card)).toBe(0);
    }
    expect(observePublicCards(memory, deck).revealedIds.size).toBe(108);
  });

  it("rejects a mixed valid and forged reveal atomically", () => {
    const [valid, second] = createDeck(4);
    expect(valid).toBeDefined();
    expect(second).toBeDefined();
    const initial = createPublicCardMemory(4);
    const forged = { ...second!, id: "forged-public-card" };
    expect(() => observePublicCards(initial, [valid!, forged])).toThrow("identity");
    expect(initial.revealedIds.size).toBe(0);
    expect(initial.revealedByFace.size).toBe(0);
    expect(unseenPublicCopies(initial, valid!.card)).toBe(2);
  });
});
