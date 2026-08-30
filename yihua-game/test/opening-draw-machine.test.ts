import { describe, expect, it } from "vitest";
import type { DeckCard } from "../src/core/deck.js";
import {
  advanceOpeningDrawMachine,
  completeOpeningDrawMachine,
  createOpeningDrawMachine,
  openingDrawMachinePrompt,
  openingDrawMachineResult,
} from "../src/core/opening-draw-machine.js";

const suited = (
  id: string,
  copy: number,
  suit: "clubs" | "diamonds" | "spades" | "hearts",
  rank: "7" | "8" | "9" | "A",
): DeckCard => ({ id, copy, card: { kind: "suited", suit, rank } });

const joker = (id: string, copy: number): DeckCard => ({
  id,
  copy,
  card: { kind: "joker", size: "big" },
});

describe("stepwise opening draw machine", () => {
  it("redraws only the seats tied for the highest opening card", () => {
    const deck: DeckCard[] = [
      suited("0:a", 0, "hearts", "A"),
      suited("1:a", 1, "hearts", "A"),
      suited("0:7", 0, "clubs", "7"),
      suited("0:8", 0, "clubs", "8"),
      joker("0:joker", 0),
      suited("1:7", 1, "clubs", "7"),
      suited("1:8", 1, "diamonds", "8"),
      suited("1:a2", 1, "spades", "A"),
      suited("1:9", 1, "hearts", "9"),
    ];

    let state = createOpeningDrawMachine(deck, 4, () => 0.999999);
    expect(state.phase).toBe("drawing");
    expect(openingDrawMachineResult(state)).toBeNull();

    state = advanceOpeningDrawMachine(state);
    expect(state.phase).toBe("drawing");
    expect(state.session.attempts).toHaveLength(1);
    expect(state.session.attempts[0]!.winnerSeat).toBeNull();
    expect(openingDrawMachinePrompt(state)).toMatchObject({
      isRedraw: true,
      seatsToDraw: [0, 1],
      cardsRequired: 2,
    });

    state = advanceOpeningDrawMachine(state);
    expect(state.phase).toBe("complete");
    expect(state.session.attempts).toHaveLength(2);
    expect(
      state.session.attempts[1]!.seatDraws.map(({ seat }) => seat),
    ).toEqual([0, 1]);
    expect(openingDrawMachineResult(state)).toMatchObject({ winnerSeat: 1 });
    expect(() => advanceOpeningDrawMachine(state)).toThrow(
      "opening draw machine is already complete",
    );
  });

  it("can finish a tied opening draw without hiding redraw attempts", () => {
    const deck: DeckCard[] = [
      suited("0:a", 0, "hearts", "A"),
      suited("1:a", 1, "hearts", "A"),
      suited("0:7", 0, "clubs", "7"),
      suited("0:8", 0, "clubs", "8"),
      suited("1:7", 1, "clubs", "7"),
      suited("1:8", 1, "diamonds", "8"),
      suited("1:a2", 1, "spades", "A"),
      suited("1:9", 1, "hearts", "9"),
    ];

    const complete = completeOpeningDrawMachine(
      createOpeningDrawMachine(deck, 4, () => 0.999999),
    );
    const result = openingDrawMachineResult(complete);

    expect(complete.phase).toBe("complete");
    expect(result?.attempts).toHaveLength(2);
    expect(result?.attempts[0]!.winnerSeat).toBeNull();
    expect(result?.attempts[1]!.winnerSeat).toBe(1);
    expect(result?.winnerSeat).toBe(1);
    expect(completeOpeningDrawMachine(complete)).toBe(complete);
  });

  it.each([4, 6, 8, 10, 12, 14] as const)(
    "preserves seat mapping for a %i-player first-attempt winner",
    (playerCount) => {
      const deck = Array.from({ length: playerCount }, (_, seat) =>
        suited(
          `0:${seat}`,
          0,
          seat === playerCount - 1 ? "hearts" : "clubs",
          seat === playerCount - 1 ? "A" : "7",
        ),
      );

      let state = createOpeningDrawMachine(deck, playerCount, () => 0.999999);
      state = advanceOpeningDrawMachine(state);

      expect(state.phase).toBe("complete");
      expect(
        state.session.attempts[0]!.seatDraws.map(({ seat }) => seat),
      ).toEqual(Array.from({ length: playerCount }, (_, seat) => seat));
      expect(openingDrawMachineResult(state)?.winnerSeat).toBe(playerCount - 1);
    },
  );
});
