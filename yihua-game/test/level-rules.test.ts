import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import {
  canBeatWithLevelRules,
  classifyWithLevelRules,
  compareOrdinaryRanks,
  isHeartLevelWildcard,
} from "../src/core/level-rules.js";

const suited = (rank: Rank, suit: Suit): Card => ({
  kind: "suited",
  rank,
  suit,
});
const rules = { levelRank: "7" as const };

describe("level-card rules", () => {
  it("places the current level rank above ordinary suited ranks", () => {
    expect(compareOrdinaryRanks("7", "A", rules)).toBeGreaterThan(0);
    expect(compareOrdinaryRanks("A", "K", rules)).toBeGreaterThan(0);
    expect(compareOrdinaryRanks("6", "5", rules)).toBeGreaterThan(0);
  });

  it("marks only the heart level card as a wildcard", () => {
    expect(isHeartLevelWildcard(suited("7", "hearts"), rules)).toBe(true);
    expect(isHeartLevelWildcard(suited("7", "spades"), rules)).toBe(false);
    expect(isHeartLevelWildcard(suited("8", "hearts"), rules)).toBe(false);
  });

  it("keeps a heart level card natural when played alone", () => {
    const hands = classifyWithLevelRules([suited("7", "hearts")], rules);
    expect(hands).toEqual([{ kind: "single", size: 1, rank: "7" }]);
  });

  it("uses a heart level card to complete a pair and triple", () => {
    const pairKinds = classifyWithLevelRules(
      [suited("9", "clubs"), suited("7", "hearts")],
      rules,
    );
    expect(pairKinds).toContainEqual({ kind: "pair", size: 2, rank: "9" });

    const tripleKinds = classifyWithLevelRules(
      [suited("Q", "clubs"), suited("Q", "spades"), suited("7", "hearts")],
      rules,
    );
    expect(tripleKinds).toContainEqual({ kind: "triple", size: 3, rank: "Q" });
  });

  it("uses a heart level card in three-with-pair, straight, wood board and steel board", () => {
    expect(
      classifyWithLevelRules(
        [
          suited("10", "clubs"),
          suited("10", "spades"),
          suited("10", "diamonds"),
          suited("J", "clubs"),
          suited("7", "hearts"),
        ],
        rules,
      ),
    ).toContainEqual({ kind: "triple-pair", size: 5, rank: "10" });

    expect(
      classifyWithLevelRules(
        [
          suited("3", "clubs"),
          suited("4", "diamonds"),
          suited("5", "spades"),
          suited("6", "clubs"),
          suited("7", "hearts"),
        ],
        rules,
      ),
    ).toContainEqual({ kind: "straight", size: 5, rank: "7" });

    expect(
      classifyWithLevelRules(
        [
          suited("8", "clubs"),
          suited("8", "spades"),
          suited("9", "clubs"),
          suited("9", "spades"),
          suited("10", "clubs"),
          suited("7", "hearts"),
        ],
        rules,
      ),
    ).toContainEqual({ kind: "wood-board", size: 6, rank: "10" });

    expect(
      classifyWithLevelRules(
        [
          suited("J", "clubs"),
          suited("J", "spades"),
          suited("J", "diamonds"),
          suited("Q", "clubs"),
          suited("Q", "spades"),
          suited("7", "hearts"),
        ],
        rules,
      ),
    ).toContainEqual({ kind: "steel-board", size: 6, rank: "Q" });
  });

  it("uses the wildcard to complete bombs and straight flushes", () => {
    expect(
      classifyWithLevelRules(
        [
          suited("K", "clubs"),
          suited("K", "spades"),
          suited("K", "diamonds"),
          suited("7", "hearts"),
        ],
        rules,
      ),
    ).toContainEqual({ kind: "bomb", size: 4, rank: "K" });

    expect(
      classifyWithLevelRules(
        [
          suited("8", "spades"),
          suited("9", "spades"),
          suited("10", "spades"),
          suited("J", "spades"),
          suited("7", "hearts"),
        ],
        rules,
      ),
    ).toContainEqual({
      kind: "straight-flush",
      size: 5,
      rank: "Q",
      suit: "spades",
    });
  });

  it("allows wildcard interpretations to beat the matching current hand", () => {
    const challenger = [suited("A", "clubs"), suited("7", "hearts")];
    const current = [suited("K", "clubs"), suited("K", "spades")];
    expect(canBeatWithLevelRules(challenger, current, rules)).toBe(true);
  });
});
