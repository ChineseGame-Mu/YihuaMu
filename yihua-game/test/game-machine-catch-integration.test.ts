import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import { transitionGame } from "../src/core/game-machine.js";
import type { PlayingState } from "../src/core/game-state.js";
import { createTableConfig } from "../src/core/table.js";
import { createTrickState } from "../src/core/trick-state.js";

const suited = (
  rank: "3" | "4" | "5" | "6",
  suit: "clubs" | "hearts" = "clubs",
): Card => ({ kind: "suited", rank, suit });

const deckCard = (id: string, card: Card): DeckCard => ({ id, copy: 0, card });

const expectPlaying = (
  state: ReturnType<typeof transitionGame>,
): PlayingState => {
  expect(state.phase).toBe("playing");
  if (state.phase !== "playing") throw new Error("expected playing state");
  return state;
};

describe("table machine finished-leader catch integration", () => {
  it("lets only opponents answer a finished leader, then hands the cleared trick to the active teammate", () => {
    const lead = suited("3");
    const opponent1 = suited("4");
    const partner = suited("5");
    const opponent3 = suited("6");

    const initial: PlayingState = {
      phase: "playing",
      config: createTableConfig(4, 0),
      openingDraw: { attempts: [], winnerSeat: 0 },
      hands: [
        [deckCard("seat0-last", lead)],
        [deckCard("seat1-card", opponent1)],
        [deckCard("seat2-card", partner)],
        [deckCard("seat3-card", opponent3)],
      ],
      currentTurn: 0,
      trick: createTrickState(4, 0),
      finishedSeats: [],
    };

    const afterLead = expectPlaying(
      transitionGame(initial, { type: "play-cards", seat: 0, cards: [lead] }),
    );
    expect(afterLead.finishedSeats).toEqual([0]);
    expect(afterLead.currentTurn).toBe(1);
    expect(afterLead.trick.leadingPlay?.seat).toBe(0);

    const afterSeat1Pass = expectPlaying(
      transitionGame(afterLead, { type: "pass-turn", seat: 1 }),
    );
    expect(afterSeat1Pass.currentTurn).toBe(3);

    const caught = expectPlaying(
      transitionGame(afterSeat1Pass, { type: "pass-turn", seat: 3 }),
    );
    expect(caught.trick.leadingPlay).toBeNull();
    expect(caught.trick.passedSeats).toEqual([]);
    expect(caught.trick.completedTricks).toBe(1);
    expect(caught.trick.leaderSeat).toBe(2);
    expect(caught.currentTurn).toBe(2);

    const afterPartnerLead = transitionGame(caught, {
      type: "play-cards",
      seat: 2,
      cards: [partner],
    });
    expect(afterPartnerLead.phase).toBe("playing");
    if (afterPartnerLead.phase !== "playing") {
      throw new Error("expected playing state after partner lead");
    }
    expect(afterPartnerLead.finishedSeats).toEqual([0, 2]);
    expect(afterPartnerLead.trick.leadingPlay?.seat).toBe(2);
    expect(afterPartnerLead.currentTurn).toBe(3);
  });
});
