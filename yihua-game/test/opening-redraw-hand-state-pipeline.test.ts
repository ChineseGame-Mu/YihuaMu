import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  completeTableOpeningDraw,
  createTableRoundState,
  playTableCards,
} from "../src/core/table-state-machine.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const PLAYER_COUNTS: readonly SupportedPlayerCount[] = [4, 6, 8, 10, 12, 14];
const KEEP_ORDER = (): number => 0.999999;

const suitedDeckCard = (
  id: string,
  rank: "3" | "4" | "A",
  suit: "clubs" | "hearts",
): DeckCard => ({
  id,
  copy: 0,
  card: { kind: "suited", rank, suit },
});

const suited = (
  rank: "3" | "4",
  suit: "clubs" | "hearts",
): Card => ({ kind: "suited", rank, suit });

const redrawDeck = (playerCount: SupportedPlayerCount): DeckCard[] => {
  const tiedAttempt = Array.from({ length: playerCount }, (_, seat) =>
    suitedDeckCard(`tie:${seat}`, "A", "clubs"),
  );
  const decidingAttempt = Array.from({ length: playerCount }, (_, seat) =>
    suitedDeckCard(
      `decide:${seat}`,
      seat === playerCount - 1 ? "A" : "3",
      seat === playerCount - 1 ? "hearts" : "clubs",
    ),
  );
  return [...tiedAttempt, ...decidingAttempt];
};

describe("opening redraw -> hand validation -> table state pipeline", () => {
  it.each(PLAYER_COUNTS)(
    "%i players keeps the table clean after an invalid opening play, then accepts a legal play",
    (playerCount) => {
      const opening = createTableRoundState(
        redrawDeck(playerCount),
        playerCount,
        KEEP_ORDER,
      );
      const playing = completeTableOpeningDraw(opening);
      const winnerSeat = playing.openingDraw.winnerSeat;

      expect(playing.openingDraw.attempts).toHaveLength(2);
      expect(playing.openingDraw.attempts[0]?.winnerSeat).toBeNull();
      expect(winnerSeat).toBe(playerCount - 1);
      expect(playing.phase).toBe("playing");
      expect(playing.trick?.currentTurn).toBe(winnerSeat);
      expect(playing.trick?.leadingPlay).toBeNull();

      expect(() =>
        playTableCards(playing, winnerSeat!, [
          suited("3", "clubs"),
          suited("3", "hearts"),
          suited("4", "clubs"),
        ]),
      ).toThrow("invalid hand");

      expect(playing.trick?.currentTurn).toBe(winnerSeat);
      expect(playing.trick?.leadingPlay).toBeNull();
      expect(playing.trick?.passedSeats).toEqual([]);

      const afterLegalPlay = playTableCards(playing, winnerSeat!, [
        suited("3", "clubs"),
        suited("3", "hearts"),
      ]);

      expect(afterLegalPlay.trick?.leadingPlay?.seat).toBe(winnerSeat);
      expect(afterLegalPlay.trick?.leadingPlay?.hand.kind).toBe("pair");
      expect(afterLegalPlay.trick?.currentTurn).toBe(
        (winnerSeat! + 1) % playerCount,
      );
      expect(afterLegalPlay.trick?.passedSeats).toEqual([]);
    },
  );
});
