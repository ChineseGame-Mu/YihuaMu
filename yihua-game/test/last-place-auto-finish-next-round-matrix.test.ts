import { describe, expect, it } from "vitest";
import type { DeckCard } from "../src/core/deck.js";
import {
  playGameCards,
  startNextRound,
  type PlayingState,
} from "../src/core/game-state.js";
import {
  createTableConfig,
  SUPPORTED_PLAYER_COUNTS,
} from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const card = (id: string, rank: "3" | "4"): DeckCard => ({
  id,
  copy: 0,
  card: { kind: "suited", suit: "clubs", rank },
});

describe("global round-end to next-round transition", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "auto-assigns the final place and starts a fresh next round for %i players",
    (playerCount) => {
      const penultimateSeat = playerCount - 2;
      const lastSeat = playerCount - 1;
      const alreadyFinished = Array.from(
        { length: playerCount - 2 },
        (_, seat) => seat,
      );
      const hands = Array.from({ length: playerCount }, () => [] as DeckCard[]);
      hands[penultimateSeat] = [card(`finish-${playerCount}`, "3")];
      hands[lastSeat] = [
        card(`last-a-${playerCount}`, "3"),
        card(`last-b-${playerCount}`, "4"),
      ];

      const state: PlayingState = {
        phase: "playing",
        config: createTableConfig(playerCount, 0),
        openingDraw: { attempts: [], winnerSeat: 0 },
        hands,
        currentTurn: penultimateSeat,
        trick: createTrickState(playerCount, penultimateSeat),
        finishedSeats: alreadyFinished,
      };

      const completed = playGameCards(state, penultimateSeat, [
        hands[penultimateSeat]![0]!.card,
      ]);

      expect(completed.phase).toBe("round-complete");
      if (completed.phase !== "round-complete") return;
      expect(completed.finishedSeats).toHaveLength(playerCount);
      expect(completed.finishedSeats.at(-1)).toBe(lastSeat);
      expect(completed.placements).toHaveLength(playerCount);
      expect(completed.outcome).not.toBeNull();
      expect(completed.hands[lastSeat]).toHaveLength(2);

      const next = startNextRound(completed, () => 0.5);
      expect(next.phase).toBe("playing");
      expect(next.finishedSeats).toEqual([]);
      expect(next.hands).toHaveLength(playerCount);
      expect(next.hands.every((hand) => hand.length === 27)).toBe(true);
      expect(next.currentTurn).toBe(completed.outcome!.firstPlaceSeat);
    },
  );
});
