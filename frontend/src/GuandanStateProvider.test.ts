import {
  adaptGuandanServerMessage,
  initialGuandanTableState,
  shouldClearOwnHand,
} from "./guandanCompatibilityAdapter";

describe("Guandan compatibility adapter", () => {
  test("does not clear a live hand for a transient zero hand count", () => {
    expect(shouldClearOwnHand(1, [])).toBe(false);
  });

  test("clears the hand only after the player is explicitly finished", () => {
    expect(shouldClearOwnHand(1, [0, 1])).toBe(true);
  });

  test("never clears observer state without a seat", () => {
    expect(shouldClearOwnHand(null, [0, 1, 2, 3])).toBe(false);
  });

  test("maps backend waiting fields into stable table-state names", () => {
    const next = adaptGuandanServerMessage(initialGuandanTableState, {
      type: "waiting",
      players: ["A", "B", "C", "D"],
      observers: ["E"],
      online_players: [true, true, true, false],
      minimum_players: 4,
      maximum_players: 14,
    });

    expect(next.players).toEqual(["A", "B", "C", "D"]);
    expect(next.onlinePlayers).toEqual([true, true, true, false]);
    expect(next.minimumPlayers).toBe(4);
    expect(next.maximumPlayers).toBe(14);
  });
});
