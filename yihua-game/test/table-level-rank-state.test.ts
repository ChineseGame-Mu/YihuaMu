import { describe, expect, it } from "vitest";
import type { Card, Rank } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  completeTableOpeningDraw,
  createTableRoundState,
  FIRST_TABLE_LEVEL_RANK,
  playTableCards,
  playTableCardsWithLevel,
  startNextTableRound,
} from "../src/core/table-state-machine.js";
import type { SupportedPlayerCount } from "../src/core/table.js";

const PLAYER_COUNTS: readonly SupportedPlayerCount[] = [4, 6, 8, 10, 12, 14];
const KEEP_ORDER = (): number => 0.999999;

const card = (
  rank: Rank,
  suit: "clubs" | "diamonds" | "hearts" | "spades",
): Card => ({
  kind: "suited",
  rank,
  suit,
});

const openingDeck = (playerCount: SupportedPlayerCount): DeckCard[] =>
  Array.from({ length: playerCount }, (_, seat) => ({
    id: `opening:${seat}`,
    copy: 0,
    card: card(seat === 0 ? "A" : "3", seat === 0 ? "hearts" : "clubs"),
  }));

describe("table state carries level-rank hand judgment", () => {
  it.each(PLAYER_COUNTS)(
    "%i players lets the first-round level pair beat an ace pair",
    (playerCount) => {
      const opening = createTableRoundState(
        openingDeck(playerCount),
        playerCount,
        KEEP_ORDER,
      );
      const playing = completeTableOpeningDraw(opening);

      expect(playing.levelRank).toBe(FIRST_TABLE_LEVEL_RANK);
      expect(playing.openingDraw.winnerSeat).toBe(0);

      const aceLead = playTableCards(playing, 0, [
        card("A", "clubs"),
        card("A", "diamonds"),
      ]);
      expect(aceLead.trick?.leadingPlay?.hand.kind).toBe("pair");
      expect(aceLead.trick?.currentTurn).toBe(1);

      const levelBeat = playTableCards(aceLead, 1, [
        card("2", "clubs"),
        card("2", "diamonds"),
      ]);
      expect(levelBeat.trick?.leadingPlay?.seat).toBe(1);
      expect(levelBeat.trick?.leadingPlay?.hand.kind).toBe("pair");
      expect(levelBeat.trick?.currentTurn).toBe(2 % playerCount);
    },
  );

  it("supports an explicit later-round level rank without bypassing table state", () => {
    const playing = completeTableOpeningDraw(
      createTableRoundState(openingDeck(4), 4, KEEP_ORDER, "7"),
    );
    const aceLead = playTableCards(playing, 0, [card("A", "clubs")]);
    const levelBeat = playTableCards(aceLead, 1, [card("7", "hearts")]);

    expect(playing.levelRank).toBe("7");
    expect(levelBeat.trick?.leadingPlay?.seat).toBe(1);
    expect(levelBeat.trick?.leadingPlay?.hand.kind).toBe("single");
  });

  it("persists an explicit level-rank change for subsequent table plays", () => {
    const playing = completeTableOpeningDraw(
      createTableRoundState(openingDeck(4), 4, KEEP_ORDER),
    );
    const aceLead = playTableCardsWithLevel(
      playing,
      0,
      [card("A", "clubs")],
      "7",
    );

    expect(aceLead.levelRank).toBe("7");

    const levelBeat = playTableCards(aceLead, 1, [card("7", "spades")]);
    expect(levelBeat.levelRank).toBe("7");
    expect(levelBeat.trick?.leadingPlay?.seat).toBe(1);
    expect(levelBeat.trick?.leadingPlay?.hand).toMatchObject({
      kind: "single",
      rank: "7",
    });
  });

  it.each(PLAYER_COUNTS)(
    "%i players carries the active level rank and winner into the next round",
    (playerCount) => {
      const playing = completeTableOpeningDraw(
        createTableRoundState(openingDeck(playerCount), playerCount, KEEP_ORDER, "9"),
      );
      const finishingOrder = Array.from(
        { length: playerCount },
        (_, seat) => seat,
      );
      const completed = {
        ...playing,
        phase: "round-complete" as const,
        activeSeats: [playerCount - 1],
        finishingOrder,
      };

      const nextRound = startNextTableRound(completed);

      expect(nextRound.phase).toBe("playing");
      expect(nextRound.levelRank).toBe("9");
      expect(nextRound.finishingOrder).toEqual([]);
      expect(nextRound.activeSeats).toEqual(finishingOrder);
      expect(nextRound.trick?.leaderSeat).toBe(0);
      expect(nextRound.trick?.currentTurn).toBe(0);

      const aceLead = playTableCards(nextRound, 0, [card("A", "clubs")]);
      const levelBeat = playTableCards(aceLead, 1, [card("9", "diamonds")]);
      expect(levelBeat.trick?.leadingPlay?.seat).toBe(1);
    },
  );
});
