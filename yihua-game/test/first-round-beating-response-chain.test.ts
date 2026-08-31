import { describe, expect, it } from "vitest";
import {
  classifyGameCardIds,
  passGameSeat,
  playGameCardIds,
} from "../src/core/game-actions.js";
import {
  createLobbyState,
  FIRST_ROUND_LEVEL_RANK,
  type PlayingState,
} from "../src/core/game-state.js";
import { canHandBeatWithLevel } from "../src/core/hand.js";
import {
  beginInteractiveOpeningDraw,
  completeInteractiveOpeningDraw,
  dealAfterInteractiveOpeningDraw,
  interactiveOpeningSnapshot,
} from "../src/core/interactive-opening-state.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

const keepDeckOrder = (): number => 0.999999;

describe("first-round accepted response chain", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "accepts the first legal beating response and resets prior passes for %i players",
    (playerCount) => {
      const completed = completeInteractiveOpeningDraw(
        beginInteractiveOpeningDraw(
          createLobbyState(playerCount, 0),
          keepDeckOrder,
        ),
      );
      const opening = interactiveOpeningSnapshot(completed);
      const winnerSeat = opening.winnerSeat!;
      const playing = dealAfterInteractiveOpeningDraw(completed, keepDeckOrder);
      const openingCard = playing.hands[winnerSeat]![0]!;
      let state = playGameCardIds(playing, winnerSeat, [
        openingCard.id,
      ]) as PlayingState;
      const openingHand = state.trick.leadingPlay!.hand;

      let responseSeat: number | null = null;
      let responseCardId: string | null = null;
      let responseOffset = 0;

      for (let offset = 1; offset < playerCount; offset += 1) {
        const seat = (winnerSeat + offset) % playerCount;
        const card = state.hands[seat]!.find(({ id }) => {
          const candidate = classifyGameCardIds(state, seat, [id]);
          return (
            candidate.kind !== "invalid" &&
            canHandBeatWithLevel(candidate, openingHand, FIRST_ROUND_LEVEL_RANK)
          );
        });
        if (card !== undefined) {
          responseSeat = seat;
          responseCardId = card.id;
          responseOffset = offset;
          break;
        }
      }

      expect(responseSeat).not.toBeNull();
      expect(responseCardId).not.toBeNull();

      for (let offset = 1; offset < responseOffset; offset += 1) {
        const seat = (winnerSeat + offset) % playerCount;
        expect(state.currentTurn).toBe(seat);
        state = passGameSeat(state, seat);
      }

      expect(state.currentTurn).toBe(responseSeat);
      expect(state.trick.passedSeats).toHaveLength(responseOffset - 1);
      const responseHandSize = state.hands[responseSeat!]!.length;

      const next = playGameCardIds(state, responseSeat!, [
        responseCardId!,
      ]) as PlayingState;

      expect(next.trick.leadingPlay?.seat).toBe(responseSeat);
      expect(next.trick.leadingPlay?.hand.kind).toBe("single");
      expect(next.hands[responseSeat!]).toHaveLength(responseHandSize - 1);
      expect(next.trick.passedSeats).toEqual([]);
      expect(next.currentTurn).toBe((responseSeat! + 1) % playerCount);
      expect(next.trick.completedTricks).toBe(0);
      expect(next.levelRank).toBe(FIRST_ROUND_LEVEL_RANK);
    },
  );
});
