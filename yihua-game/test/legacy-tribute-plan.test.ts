import { describe, expect, it } from "vitest";
import type { ManagedRoom } from "../src/core/room-manager.js";
import {
  applyLegacyTributeResistance,
  legacyTributePlan,
  legacyTributeResisted,
  prepareLegacyTribute,
  resolveLegacyTributeResistance,
} from "../src/core/legacy-tribute.js";

const resistanceRoom = (
  hands: Array<Array<{ id: string; card: { kind: "joker"; size: "big" } }>>,
): ManagedRoom =>
  ({
    game: {
      phase: "playing",
      hands,
      currentTurn: 3,
      trick: {
        currentTurn: 3,
        leaderSeat: 3,
        leadingPlay: null,
        plays: [],
        passedSeats: [],
      },
    },
  }) as unknown as ManagedRoom;

describe("approved legacy tribute mapping", () => {
  it("makes fourth place tribute first place after a normal result", () => {
    prepareLegacyTribute("single-tribute", [0, 1, 2, 3]);

    expect(legacyTributePlan("single-tribute")).toEqual({
      Single: { giver: 3, receiver: 0 },
    });
  });

  it("makes both losing players tribute both winners after a double-down", () => {
    prepareLegacyTribute("double-tribute", [0, 2, 1, 3]);

    expect(legacyTributePlan("double-tribute")).toEqual({
      Double: {
        givers: [1, 3],
        receivers: [0, 2],
      },
    });
  });

  it("lets the tribute side resist when it collectively holds both big jokers", () => {
    prepareLegacyTribute("resisted-tribute", [0, 2, 1, 3]);
    const room = resistanceRoom([
      [],
      [{ id: "b1", card: { kind: "joker", size: "big" } }],
      [],
      [{ id: "b2", card: { kind: "joker", size: "big" } }],
    ]);

    expect(resolveLegacyTributeResistance("resisted-tribute", room)).toBe(true);
    expect(legacyTributePlan("resisted-tribute")).toBeNull();
    expect(legacyTributeResisted("resisted-tribute")).toBe(true);
  });

  it("gives the previous first-place winner the lead after two-big-joker resistance", () => {
    prepareLegacyTribute("winner-leads-after-resistance", [0, 2, 1, 3]);
    const room = resistanceRoom([
      [],
      [{ id: "b1", card: { kind: "joker", size: "big" } }],
      [],
      [{ id: "b2", card: { kind: "joker", size: "big" } }],
    ]);

    const resisted = applyLegacyTributeResistance(
      "winner-leads-after-resistance",
      room,
    );
    expect(resisted).not.toBeNull();
    if (resisted?.game.phase !== "playing") return;
    expect(resisted.game.currentTurn).toBe(0);
    expect(resisted.game.trick.leaderSeat).toBe(0);
    expect(resisted.game.trick.currentTurn).toBe(0);
  });

  it("does not resist with only one big joker", () => {
    prepareLegacyTribute("unresisted-tribute", [0, 2, 1, 3]);
    const room = resistanceRoom([
      [],
      [{ id: "b1", card: { kind: "joker", size: "big" } }],
      [],
      [],
    ]);

    expect(resolveLegacyTributeResistance("unresisted-tribute", room)).toBe(
      false,
    );
    expect(legacyTributePlan("unresisted-tribute")).not.toBeNull();
    expect(legacyTributeResisted("unresisted-tribute")).toBe(false);
  });

  it("clears tribute when the previous result is not a four-player finish", () => {
    prepareLegacyTribute("clear-tribute", [0, 1, 2, 3]);
    prepareLegacyTribute("clear-tribute", [0, 1, 2]);

    expect(legacyTributePlan("clear-tribute")).toBeNull();
  });
});
