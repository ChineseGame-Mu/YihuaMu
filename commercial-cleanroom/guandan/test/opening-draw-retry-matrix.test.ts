import { describe, expect, it } from "vitest";
import type { DeckCard } from "../src/core/deck.js";
import { runOpeningDraw } from "../src/core/opening-draw.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const PLAYER_COUNTS = [4, 6, 8, 10, 12, 14] as const;
const KEEP_ORDER = () => 0.999999;

const suitedCard = (
  id: string,
  rank: "3" | "A",
  suit: "clubs" | "hearts",
): DeckCard => ({
  id,
  copy: 0,
  card: { kind: "suited", rank, suit },
});

const retryDeck = (playerCount: SupportedPlayerCount): DeckCard[] => {
  const tiedAttempt = Array.from({ length: playerCount }, (_, seat) =>
    suitedCard(`tie:${seat}`, "A", "clubs"),
  );
  const decidingAttempt = Array.from({ length: playerCount }, (_, seat) =>
    suitedCard(
      `decide:${seat}`,
      seat === playerCount - 1 ? "A" : "3",
      seat === playerCount - 1 ? "hearts" : "clubs",
    ),
  );
  return [...tiedAttempt, ...decidingAttempt];
};

describe("opening draw retry matrix", () => {
  it.each(PLAYER_COUNTS)(
    "retries a tied draw and accepts the next unique winner for %i players",
    (playerCount: SupportedPlayerCount) => {
      const deck = retryDeck(playerCount);
      const snapshot = structuredClone(deck);

      const result = runOpeningDraw(deck, playerCount, KEEP_ORDER);

      expect(result.attempts).toHaveLength(2);
      expect(result.attempts[0]!.winnerSeat).toBeNull();
      expect(result.attempts[1]!.winnerSeat).toBe(playerCount - 1);
      expect(result.winnerSeat).toBe(playerCount - 1);
      expect(
        result.attempts.every(
          (attempt) => attempt.cards.length === playerCount,
        ),
      ).toBe(true);

      const usedIds = result.attempts.flatMap((attempt) =>
        attempt.cards.map(({ id }) => id),
      );
      expect(new Set(usedIds).size).toBe(playerCount * 2);
      expect(deck).toEqual(snapshot);
    },
  );
});
