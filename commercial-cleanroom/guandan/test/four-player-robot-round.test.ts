import { describe, expect, it } from "vitest";
import type { Card } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import {
  advanceTableOpeningDraw,
  createTableRoundState,
  playTableCards,
} from "../src/core/table-state-machine.js";

const ranks = ["3", "4", "5", "6"] as const;

const deckCard = (seat: number): DeckCard => ({
  id: `robot-${seat}`,
  copy: 0,
  card: { kind: "suited", rank: ranks[seat]!, suit: "clubs" },
});

const asCard = (value: DeckCard): Card => value.card;

describe("four-player robot round", () => {
  it("plays a deterministic four-player round through a named winner", () => {
    const openingDeck: DeckCard[] = [
      {
        id: "opening-ace",
        copy: 0,
        card: { kind: "suited", rank: "A", suit: "hearts" },
      },
      ...Array.from({ length: 8 }, (_, index) => ({
        id: `opening-${index}`,
        copy: 0 as const,
        card: {
          kind: "suited" as const,
          rank: "3" as const,
          suit: "diamonds" as const,
        },
      })),
    ];

    let state = createTableRoundState(openingDeck, 4, () => 0.999999);
    state = advanceTableOpeningDraw(state);

    expect(state.phase).toBe("playing");
    expect(state.trick?.currentTurn).toBe(0);

    for (let seat = 0; seat < 3; seat += 1) {
      state = playTableCards(state, seat, [asCard(deckCard(seat))], {
        finishesHand: true,
      });
    }

    expect(state.phase).toBe("round-complete");
    expect(state.finishingOrder).toEqual([0, 1, 2, 3]);

    const playerNames = ["机器人1", "机器人2", "机器人3", "机器人4"] as const;
    const winnerSeat = state.finishingOrder[0];
    expect(winnerSeat).toBe(0);
    expect(playerNames[winnerSeat!]).toBe("机器人1");
  });
});
