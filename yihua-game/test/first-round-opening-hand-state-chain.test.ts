import { describe, expect, it } from "vitest";
import {
  classifyGameCardIds,
  playGameCardIds,
} from "../src/core/game-actions.js";
import {
  createLobbyState,
  FIRST_ROUND_LEVEL_RANK,
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

      const playing = dealAfterInteractiveOpeningDraw(
        completed,
        keepDeckOrder,
      );
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
});
