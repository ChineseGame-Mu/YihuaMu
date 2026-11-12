import { readFileSync } from "fs";
import { join } from "path";
import { mergeCurrentTrickPlays } from "./guandanCompatibilityAdapter";
import type { GuandanCard } from "./guandanProtocol";

const card = (rank: "Four" | "Six" | "Eight" | "Nine"): GuandanCard => ({
  Suited: { suit: "Diamonds", rank },


describe("public current-trick history", () => {
  test("keeps every distinct play when server snapshots contain only the newest play", () => {
    const first = [{ player: 0, cards: [card("Four"), card("Six")] }];
    const second = [{ player: 1, cards: [card("Eight"), card("Nine")] }];

    const afterFirst = mergeCurrentTrickPlays([], first, false, false, first[0]!.cards);
    const afterSecond = mergeCurrentTrickPlays(
      afterFirst,
      second,
      false,
      false,
      second[0]!.cards,
    );

    expect(afterSecond).toHaveLength(2);
    expect(afterSecond.flatMap((play) => play.cards)).toHaveLength(4);
    expect(afterSecond[0]?.player).toBe(0);
    expect(afterSecond[1]?.player).toBe(1);
  });

  test("does not duplicate a full server snapshot", () => {
    const first = { player: 0, cards: [card("Four")] };
    const second = { player: 1, cards: [card("Six")] };
    const previous = [first, second];

    expect(
      mergeCurrentTrickPlays(previous, [first, second], false, false, second.cards),
    ).toHaveLength(2);
  });

  test("clears old cards only when the completed trick has been collected", () => {
    const previous = [{ player: 0, cards: [card("Four"), card("Six")] }];

    expect(mergeCurrentTrickPlays(previous, [], true, false, [])).toEqual([]);
  });
});
