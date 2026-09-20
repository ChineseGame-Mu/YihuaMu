import { autoArrangeGuandanHand } from "./guandanAutoArrange";
import type { GuandanCard, GuandanRank } from "./guandanProtocol";

const rank: Record<string, GuandanRank> = {
  A: "Ace",
  "2": "Two",
  "3": "Three",
  "4": "Four",
  "5": "Five",
  "6": "Six",
};

const hand = (labels: string[]) =>
  labels.map((label, originalIndex) => {
    const [value, suit = "Clubs"] = label.split("-");
    return {
      originalIndex,
      card: {
        Suited: { rank: rank[value!]!, suit },
      } as GuandanCard,
    };
  });

describe("automatic Guandan hand arranging", () => {
  test("forms the minimum A2345 straight and preserves every original index", () => {
    const input = hand(["6", "3", "A", "5", "2", "4"]);
    const arranged = autoArrangeGuandanHand(input, "asc");

    expect(
      arranged.slice(0, 5).map(({ originalIndex }) => originalIndex),
    ).toEqual([2, 4, 1, 5, 3]);
    expect(new Set(arranged.map(({ originalIndex }) => originalIndex))).toEqual(
      new Set(input.map(({ originalIndex }) => originalIndex)),
    );
  });

  test("keeps two consecutive triples together as a steel plate", () => {
    const input = hand(["4", "3", "4", "3", "4", "3", "6"]);
    const arranged = autoArrangeGuandanHand(input, "asc");
    expect(arranged.slice(0, 6).map(({ card }) => card)).toEqual([
      input[1]!.card,
      input[3]!.card,
      input[5]!.card,
      input[0]!.card,
      input[2]!.card,
      input[4]!.card,
    ]);
  });

  test("detects a same-suit A2345 before ordinary groups", () => {
    const input = hand([
      "3-Hearts",
      "5-Hearts",
      "A-Hearts",
      "2-Hearts",
      "4-Hearts",
      "6-Clubs",
    ]);
    expect(
      autoArrangeGuandanHand(input, "asc")
        .slice(0, 5)
        .map(({ originalIndex }) => originalIndex),
    ).toEqual([2, 3, 0, 4, 1]);
  });
});
