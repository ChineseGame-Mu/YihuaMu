import { describe, expect, test } from "vitest";

import {
  legacyTributePlan,
  prepareLegacyTribute,
} from "../src/core/legacy-tribute.js";

describe("6-14 player single-tribute last-place rule", () => {
  for (const playerCount of [6, 8, 10, 12, 14] as const) {
    test(`${playerCount} players: overall last place pays first even when they are teammates`, () => {
      // Seat 0 is first. Seat playerCount-2 has the same team parity as seat 0
      // and is deliberately placed last. Seat 1 is second, so this is not
      // double-down and must remain a single tribute.
      const finishOrder = Array.from({ length: playerCount }, (_, seat) => seat);
      const teammateLast = playerCount - 2;
      const otherLast = playerCount - 1;
      finishOrder[playerCount - 2] = otherLast;
      finishOrder[playerCount - 1] = teammateLast;

      const roomId = `expanded-single-${playerCount}`;
      prepareLegacyTribute(roomId, finishOrder);

      expect(legacyTributePlan(roomId)).toEqual({
        Single: {
          giver: teammateLast,
          receiver: 0,
        },
      });
    });
  }
});
