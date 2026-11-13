import { mergeCurrentTrickPlays } from "./guandanCompatibilityAdapter";
import type { GuandanCard } from "./guandanProtocol";

const card = (rank: "Four" | "Six" | "Eight"): GuandanCard => ({
  Suited: { suit: "Diamonds", rank },
});

test("a genuinely new trick replaces completed cards rather than accumulating stale seats", () => {
  const previous = [
    { player: 0, cards: [card("Four")] },
    { player: 1, cards: [card("Six")] },
  ];
  const newPlay = { player: 2, cards: [card("Eight")] };
  expect(
    mergeCurrentTrickPlays(previous, [newPlay], true, false, newPlay.cards),
  ).toEqual([newPlay]);
});

test("an authoritative empty collection clears the previous trick", () => {
  const previous = [{ player: 0, cards: [card("Four")] }];
  expect(mergeCurrentTrickPlays(previous, [], true, false, [])).toEqual([]);
});
