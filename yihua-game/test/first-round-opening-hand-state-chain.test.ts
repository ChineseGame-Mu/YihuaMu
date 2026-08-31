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
import {
  beginInteractiveOpeningDraw,
  completeInteractiveOpeningDraw,
  dealAfterInteractiveOpeningDraw,
  interactiveOpeningSnapshot,
} from "../src/core/interactive-opening-state.js";
import { SUPPORTED_PLAYER_COUNTS } from "../src/core/table.js";

const keepDeckOrder = (): number => 0.999999;

describe("first-round opening draw -> hand judgment -> table state chain", () => {
  it.each(SUPPORTED_PLAYER_COUNTS)(
    "connects the complete clean-room first-play chain for %i players",
    (playerCount) => {
      const lobby = createLobbyState(playerCount, 0);
      const drawing = beginInteractiveOpeningDraw(lobby, keepDeckOrder);
      const completed = completeInteractiveOpeningDraw(drawing);
      const opening = interactiveOpeningSnapshot(completed);

      expect(opening.readyToDeal).toBe(true);
      expect(opening.winnerSeat).not.toBeNull();
      expect(opening.attempts.length).toBeGreaterThan(0);

      const playing = dealAfterInteractiveOpeningDraw(completed, keepDeckOrder);
      const winnerSeat = opening.winnerSeat!;

      expect(playing.phase).toBe("playing");
      expect(playing.currentTurn).toBe(winnerSeat);
      expect(playing.levelRank).toBe(FIRST_ROUND_LEVEL_RANK);
      expect(playing.hands).toHaveLength(playerCount);
      expect(playing.hands.every((hand) => hand.length === 27)).toBe(true);

      const openingCard = playing.hands[winnerSeat]![0]!;
      expect(
        classifyGameCardIds(playing, winnerSeat, [openingCard.id]),
      ).toMatchObject({ kind: "single", size: 1 });

      const next = playGameCardIds(playing, winnerSeat, [openingCard.id]);
      expect(next.phase).toBe("playing");
      expect(next.hands[winnerSeat]).toHaveLength(26);
      expect(next.trick.leadingPlay?.seat).toBe(winnerSeat);
      expect(next.trick.leadingPlay?.cards).toHaveLength(1);
      expect(next.currentTurn).toBe((winnerSeat + 1) % playerCount);
      expect(next.finishedSeats).toEqual([]);
    },
  );

  it.each(SUPPORTED_PLAYER_COUNTS)(
    "closes the first trick and returns the next lead to the opening winner for %i players",
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

      expect(state.trick.completedTricks).toBe(0);
      expect(state.trick.leadingPlay?.seat).toBe(winnerSeat);

      for (let offset = 1; offset < playerCount; offset += 1) {
        const seat = (winnerSeat + offset) % playerCount;
        expect(state.currentTurn).toBe(seat);
        state = passGameSeat(state, seat);
      }

      expect(state.trick.leadingPlay).toBeNull();
      expect(state.trick.passedSeats).toEqual([]);
      expect(state.trick.completedTricks).toBe(1);
      expect(state.trick.leaderSeat).toBe(winnerSeat);
      expect(state.currentTurn).toBe(winnerSeat);
      expect(state.levelRank).toBe(FIRST_ROUND_LEVEL_RANK);
    },
  );

  it.each(SUPPORTED_PLAYER_COUNTS)(
    "continues the opening winner into a validated second trick for %i players",
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
      const firstCard = playing.hands[winnerSeat]![0]!;
      let state = playGameCardIds(playing, winnerSeat, [firstCard.id]) as PlayingState;

      for (let offset = 1; offset < playerCount; offset += 1) {
        state = passGameSeat(state, (winnerSeat + offset) % playerCount);
      }

      const secondCard = state.hands[winnerSeat]![0]!;
      expect(
        classifyGameCardIds(state, winnerSeat, [secondCard.id]),
      ).toMatchObject({ kind: "single", size: 1 });

      const secondTrick = playGameCardIds(state, winnerSeat, [secondCard.id]);
      expect(secondTrick.phase).toBe("playing");
      expect(secondTrick.hands[winnerSeat]).toHaveLength(25);
      expect(secondTrick.trick.completedTricks).toBe(1);
      expect(secondTrick.trick.leadingPlay?.seat).toBe(winnerSeat);
      expect(secondTrick.trick.leadingPlay?.cards).toHaveLength(1);
      expect(secondTrick.currentTurn).toBe((winnerSeat + 1) % playerCount);
      expect(secondTrick.levelRank).toBe(FIRST_ROUND_LEVEL_RANK);
    },
  );
});
