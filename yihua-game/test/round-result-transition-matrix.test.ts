import { describe, expect, it } from "vitest";
import { createDeck, dealHands, type DeckCard } from "../src/core/deck.js";
import { transitionGame } from "../src/core/game-machine.js";
import type { GameState, PlayingState } from "../src/core/game-state.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";
import { createTableConfig, type SupportedPlayerCount } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const PLAYER_COUNTS = [4, 6, 8, 10, 12, 14] as const;

const createState = (playerCount: SupportedPlayerCount): PlayingState => ({
  phase: "playing",
  config: createTableConfig(playerCount, 0),
  openingDraw: { attempts: [], winnerSeat: 0 },
  hands: dealHands(createDeck(playerCount), playerCount),
  currentTurn: 0,
  trick: createTrickState(playerCount, 0),
  finishedSeats: [],
});

const finishRound = (initial: PlayingState): GameState => {
  let state: GameState = initial;
  for (let actions = 0; state.phase === "playing"; actions += 1) {
    if (actions >= 10000) throw new Error("round did not complete");
    const playing = state;
    const seat = playing.currentTurn;
    const hand = playing.hands[seat];
    if (hand === undefined || hand.length === 0) {
      throw new Error("turn points to finished seat");
    }
    const lead = playing.trick.leadingPlay?.hand ?? null;
    const card: DeckCard | undefined =
      lead === null
        ? hand[0]
        : hand.find((candidate) =>
            canHandBeat(classifyHand([candidate.card]), lead),
          );
    state =
      card === undefined
        ? transitionGame(playing, { type: "pass-turn", seat })
        : transitionGame(playing, {
            type: "play-cards",
            seat,
            cards: [card.card],
          });
  }
  return state;
};

describe("automatic round result transition matrix", () => {
  it.each(PLAYER_COUNTS)(
    "automatically completes, freezes commands, and gives first place the next lead for %i players",
    (playerCount) => {
      const opening = { attempts: [], winnerSeat: 0 } as const;
      const completed = finishRound(createState(playerCount));
      expect(completed.phase).toBe("round-complete");
      if (completed.phase !== "round-complete") {
        throw new Error("expected automatic round completion");
      }

      expect(completed.finishedSeats).toHaveLength(playerCount);
      expect(new Set(completed.finishedSeats).size).toBe(playerCount);
      expect(completed.placements).toHaveLength(playerCount);
      expect(completed.outcome?.firstPlaceSeat).toBe(completed.winnerSeat);
      expect(completed.outcome?.lastPlaceSeat).toBe(
        completed.finishedSeats[playerCount - 1],
      );
      expect(completed.openingDraw).toEqual(opening);

      expect(() =>
        transitionGame(completed, { type: "pass-turn", seat: 0 }),
      ).toThrow(/cannot pass-turn while game is round-complete/);
      expect(() =>
        transitionGame(completed, { type: "play-cards", seat: 0, cards: [] }),
      ).toThrow(/cannot play-cards while game is round-complete/);

      const firstPlace = completed.outcome?.firstPlaceSeat;
      expect(firstPlace).toBeDefined();
      const next = transitionGame(completed, { type: "next-round" }, () => 0);
      expect(next.phase).toBe("playing");
      if (next.phase !== "playing") throw new Error("expected next round");
      expect(next.currentTurn).toBe(firstPlace);
      expect(next.trick.leaderSeat).toBe(firstPlace);
      expect(next.trick.leadingPlay).toBeNull();
      expect(next.finishedSeats).toEqual([]);
      expect(next.hands.every((hand) => hand.length === 27)).toBe(true);
      expect(next.openingDraw).toEqual(opening);
    },
  );
});
