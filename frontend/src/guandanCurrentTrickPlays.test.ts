import { readFileSync } from "fs";
import { join } from "path";
import { mergeCurrentTrickPlays } from "./guandanCompatibilityAdapter";
import type { GuandanCard } from "./guandanProtocol";

const card = (rank: "Four" | "Six" | "Eight" | "Nine"): GuandanCard => ({
  Suited: { suit: "Diamonds", rank },
});

describe("public current-trick history", () => {
  test("holds the last cards before next-round controls", () => {
    const source = readFileSync(join(__dirname, "GuandanTable.tsx"), "utf8");
    expect(source).toContain("Date.now() + 5000");
    expect(source).toContain("!showFinalTrickHold");
    expect(source).toContain("displayedTablePlays.map");
  });

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

  test("preserves all four final seat plays across incremental snapshots", () => {
    const plays = [
      { player: 0, cards: [card("Four")] },
      { player: 1, cards: [card("Six")] },
      { player: 2, cards: [card("Eight")] },
      { player: 3, cards: [card("Nine")] },
    ];
    let history: typeof plays = [];
    for (const play of plays) {
      history = mergeCurrentTrickPlays(
        history,
        [play],
        false,
        false,
        play.cards,
      );
    }
    expect(history.map((play) => play.player)).toEqual([0, 1, 2, 3]);
    expect(history.flatMap((play) => play.cards)).toHaveLength(4);
  });

  test("starts a fresh trick after the previous completed trick is collected", () => {
    const completed = [
      { player: 0, cards: [card("Four")] },
      { player: 1, cards: [card("Six")] },
      { player: 2, cards: [card("Eight")] },
      { player: 3, cards: [card("Nine")] },
    ];
    const next = { player: 1, cards: [card("Four")] };
    expect(
      mergeCurrentTrickPlays(completed, [next], true, false, next.cards),
    ).toEqual([next]);
  });

  test("keeps all final four seat cards while the completed trick remains on screen", () => {
    const completed = [
      { player: 0, cards: [card("Four")] },
      { player: 1, cards: [card("Six")] },
      { player: 2, cards: [card("Eight")] },
      { player: 3, cards: [card("Nine")] },
    ];
    const held = mergeCurrentTrickPlays(
      completed,
      [completed[3]!],
      true,
      true,
      completed[3]!.cards,
    );
    expect(held).toEqual(completed);
    expect(held.flatMap((play) => play.cards)).toHaveLength(4);
  });

  test("retains final seat cards when a completed-trick snapshot temporarily omits all plays", () => {
    const completed = [
      { player: 0, cards: [card("Four")] },
      { player: 1, cards: [card("Six")] },
      { player: 2, cards: [card("Eight")] },
      { player: 3, cards: [card("Nine")] },
    ];
    expect(mergeCurrentTrickPlays(completed, [], true, true, [])).toEqual(completed);
    expect(mergeCurrentTrickPlays(completed, [], true, false, [])).toEqual([]);
  });

  test("does not erase final cards when an interim snapshot omits table plays but retains last play", () => {
    const finalPlays = [
      { player: 0, cards: [card("Four")] },
      { player: 1, cards: [card("Six")] },
      { player: 2, cards: [card("Eight")] },
      { player: 3, cards: [card("Nine")] },
    ];
    // The last-play field can arrive before the table-play history catches up.
    // An empty table_plays array is not by itself evidence of collection.
    expect(
      mergeCurrentTrickPlays(finalPlays, [], false, false, finalPlays[3]!.cards),
    ).toEqual(finalPlays);
  });

  test("holds final cards when completion flag drops before table history catches up", () => {
    const completed = [
      { player: 0, cards: [card("Four")] },
      { player: 1, cards: [card("Six")] },
      { player: 2, cards: [card("Eight")] },
      { player: 3, cards: [card("Nine")] },
    ];
    expect(
      mergeCurrentTrickPlays(completed, [], true, false, completed[3]!.cards),
    ).toEqual(completed);
    expect(mergeCurrentTrickPlays(completed, [], true, false, [])).toEqual([]);
  });

  test("retains all final cards if completion flag drops but server repeats the final play", () => {
    const completed = [
      { player: 0, cards: [card("Four")] },
      { player: 1, cards: [card("Six")] },
      { player: 2, cards: [card("Eight")] },
      { player: 3, cards: [card("Nine")] },
    ];
    expect(
      mergeCurrentTrickPlays(completed, [completed[3]!], true, false, completed[3]!.cards),
    ).toEqual(completed);
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
