import {
  guandanDealPresentation,
  guandanDealtCardsForSeat,
} from "./guandanDealPresentation";

describe("Guandan deal presentation", () => {
  test("deals one card at a time clockwise and reports the deck remainder", () => {
    expect(guandanDealPresentation(0, 4, 27)).toEqual({
      dealtCards: 0,
      remainingCards: 108,
      targetSeat: 0,
      totalCards: 108,
    });
    expect(guandanDealPresentation(5, 4, 27)).toEqual({
      dealtCards: 5,
      remainingCards: 103,
      targetSeat: 1,
      totalCards: 108,
    });
    expect(guandanDealPresentation(108, 4, 27)).toEqual({
      dealtCards: 108,
      remainingCards: 0,
      targetSeat: null,
      totalCards: 108,
    });
  });

  test("shows the exact number already dealt to each seat", () => {
    expect(
      [0, 1, 2, 3].map((seat) => guandanDealtCardsForSeat(5, 4, 27, seat)),
    ).toEqual([2, 1, 1, 1]);
  });

  test("supports every table size without exceeding 27 cards per player", () => {
    for (const playerCount of [4, 6, 8, 10, 12, 14]) {
      const total = playerCount * 27;
      expect(
        guandanDealPresentation(total - 1, playerCount, 27).remainingCards,
      ).toBe(1);
      expect(
        guandanDealtCardsForSeat(total, playerCount, 27, playerCount - 1),
      ).toBe(27);
    }
  });
});
