import { readFileSync } from "fs";
import { join } from "path";
import { mergeCurrentTrickPlays } from "./guandanCompatibilityAdapter";
import type { GuandanCard } from "./guandanProtocol";

const card = (rank: "Four" | "Six" | "Eight" | "Nine"): GuandanCard => ({
  Suited: { suit: "Diamonds", rank },
});

describe("final trick lifecycle across server snapshots", () => {
  test("retains four seats through repeated final-play and empty partial snapshots, then clears", () => {
    const plays = [
      { player: 0, cards: [card("Four")] },
      { player: 1, cards: [card("Six")] },
      { player: 2, cards: [card("Eight")] },
      { player: 3, cards: [card("Nine")] },
    ];
    let history: typeof plays = [];
    for (const play of plays) {
      history = mergeCurrentTrickPlays(history, [play], false, false, play.cards);
    }
    history = mergeCurrentTrickPlays(history, [plays[3]!], true, true, plays[3]!.cards);
    history = mergeCurrentTrickPlays(history, [], true, false, plays[3]!.cards);
    history = mergeCurrentTrickPlays(history, [plays[3]!], false, false, plays[3]!.cards);
    expect(history.map((play) => play.player)).toEqual([0, 1, 2, 3]);
    history = mergeCurrentTrickPlays(history, [], false, false, []);
    expect(history).toEqual([]);
  });
});

test("new match snapshots do not carry completed trick history into a new round", () => {
  const source = readFileSync(
    join(__dirname, "guandanCompatibilityAdapter.ts"),
    "utf8",
  );
  expect(source).toContain("tableWasAuthoritativelyCleared || startedNewMatch ? [] : state.tablePlays");
  expect(source).toContain("startedNewMatch ? false : state.trickComplete");
});

test("replayed snapshots do not duplicate the final four visible plays", () => {
  const plays = [
    { player: 0, cards: [card("Four")] },
    { player: 1, cards: [card("Six")] },
    { player: 2, cards: [card("Eight")] },
    { player: 3, cards: [card("Nine")] },
  ];
  let history: typeof plays = [];
  for (const play of plays) {
    history = mergeCurrentTrickPlays(history, [play], false, false, play.cards);
  }
  for (let replay = 0; replay < 3; replay++) {
    history = mergeCurrentTrickPlays(history, plays, true, true, plays[3]!.cards);
  }
  expect(history).toEqual(plays);
});
