import { guandanPromotionSteps } from "./guandanPromotion";

describe("6-14 player Guandan scoring", () => {
  test.each([
    [[0, 2, 4, 1, 3, 5], 4],
    [[0, 2, 1, 4, 3, 5], 3],
    [[0, 2, 1, 3, 4, 5], 2],
    [[0, 1, 3, 2, 4, 5], 1],
    [[0, 2, 4, 6, 1, 3, 5, 7], 5],
    [[0, 2, 4, 1, 6, 3, 5, 7], 4],
    [[0, 2, 4, 1, 3, 6, 5, 7], 3],
    [[0, 2, 1, 4, 3, 6, 5, 7], 2],
    [[0, 1, 2, 3, 4, 5, 6, 7], 1],
    [[0, 2, 4, 6, 8, 1, 3, 5, 7, 9], 6],
    [[0, 2, 4, 6, 1, 3, 5, 7, 8, 9], 4],
    [[0, 2, 4, 6, 8, 10, 1, 3, 5, 7, 9, 11], 7],
    [[0, 2, 4, 6, 8, 10, 12, 1, 3, 5, 7, 9, 11, 13], 8],
  ])("scores %j as %i", (finishOrder, expected) => {
    expect(guandanPromotionSteps(finishOrder)).toBe(expected);
  });

  test("supports Team B winning and rejects malformed results", () => {
    expect(guandanPromotionSteps([1, 3, 5, 0, 2, 4])).toBe(4);
    expect(guandanPromotionSteps([0, 1, 1, 3, 4, 5])).toBeNull();
    expect(guandanPromotionSteps([0, 1, 2, 3, 4])).toBeNull();
  });
});
