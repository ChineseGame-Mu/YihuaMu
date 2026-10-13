import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import { transitionGame } from "../src/core/game-machine.js";
import { createLobbyState, type PlayingState } from "../src/core/game-state.js";
import type { SupportedPlayerCount } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const PLAYER_COUNTS: readonly SupportedPlayerCount[] = [4, 6, 8, 10, 12, 14];

const suited = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const deckCard = (id: string, card: Card): DeckCard => ({ id, copy: 0, card });

const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

describe("opening draw, level hand judgment, and table state chain", () => {
  it.each(PLAYER_COUNTS)(
    "keeps the opening winner as leader and uses the persisted level rank for %i players",
    (playerCount) => {
      const started = transitionGame(
        createLobbyState(playerCount, 0),
        { type: "start-first-round" },
        seededRandom(7000 + playerCount),
      );
      expect(started.phase).toBe("playing");
      if (started.phase !== "playing")
        throw new Error("playing phase expected");

      const leader = started.openingDraw.winnerSeat;
      const responder = (leader + 1) % playerCount;
      const hands = Array.from({ length: playerCount }, (_, seat) => [
        deckCard(
          `filler-${seat}`,
          suited("3", seat % 2 === 0 ? "clubs" : "diamonds"),
        ),
      ]);
      hands[leader] = [
        deckCard("opening-lead-ace", suited("A", "spades")),
        deckCard("leader-filler", suited("4")),
      ];
      hands[responder] = [
        deckCard("level-two", suited("2", "hearts")),
        deckCard("responder-filler", suited("5")),
      ];

      const state: PlayingState = {
        ...started,
        hands,
        currentTurn: leader,
        trick: createTrickState(playerCount, leader),
        levelRank: "2",
        finishedSeats: [],
      };

      const lead = transitionGame(state, {
        type: "play-card-ids",
        seat: leader,
        cardIds: ["opening-lead-ace"],
      });
      expect(lead.phase).toBe("playing");
      if (lead.phase !== "playing") throw new Error("playing phase expected");
      expect(lead.currentTurn).toBe(responder);

      const beat = transitionGame(lead, {
        type: "play-card-ids",
        seat: responder,
        cardIds: ["level-two"],
      });
      expect(beat.phase).toBe("playing");
      if (beat.phase !== "playing") throw new Error("playing phase expected");

      expect(beat.levelRank).toBe("2");
      expect(beat.trick.leadingPlay).toMatchObject({
        seat: responder,
        hand: { kind: "single", rank: "2" },
      });
      expect(beat.hands[leader]).toHaveLength(1);
      expect(beat.hands[responder]).toHaveLength(1);
    },
  );
});
