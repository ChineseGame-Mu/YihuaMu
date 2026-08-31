import { describe, expect, it } from "vitest";
import { adaptGuandanClientMessage } from "../../frontend/src/guandanCompatibilityAdapter";
import type { GuandanClientMessage } from "../../frontend/src/guandanProtocol";

describe("Guandan compatibility adapter client boundary", () => {
  it.each([4, 6, 8, 10, 12, 14])(
    "adds the clean-room player_count for a %i-player join without changing the legacy message shape otherwise",
    (playerCount) => {
      const legacyJoin: GuandanClientMessage = {
        type: "join",
        room: "legacy-room",
        name: "Player 1",
      };

      expect(
        adaptGuandanClientMessage(legacyJoin, {
          cleanroom: true,
          room: "cleanroom-room",
          playerCount,
        }),
      ).toEqual({
        ...legacyJoin,
        room: "cleanroom-room",
        player_count: playerCount,
      });
    },
  );

  it("falls back to the legacy room and four players when clean-room join metadata is unusable", () => {
    const legacyJoin: GuandanClientMessage = {
      type: "join",
      room: "legacy-room",
      name: "Player 1",
    };

    expect(
      adaptGuandanClientMessage(legacyJoin, {
        cleanroom: true,
        room: "   ",
        playerCount: 5,
      }),
    ).toEqual({
      ...legacyJoin,
      player_count: 4,
    });
  });

  it("passes every non-join legacy command through by identity", () => {
    const messages: GuandanClientMessage[] = [
      { type: "start", player_count: 4 },
      { type: "play", card_indexes: [0, 2] },
      { type: "pass" },
      { type: "end_round" },
    ];

    for (const message of messages) {
      expect(
        adaptGuandanClientMessage(message, {
          cleanroom: true,
          room: "cleanroom-room",
          playerCount: 14,
        }),
      ).toBe(message);
    }
  });

  it("does not rewrite join messages outside clean-room mode", () => {
    const legacyJoin: GuandanClientMessage = {
      type: "join",
      room: "legacy-room",
      name: "Player 1",
    };

    expect(
      adaptGuandanClientMessage(legacyJoin, {
        cleanroom: false,
        room: "cleanroom-room",
        playerCount: 14,
      }),
    ).toBe(legacyJoin);
  });
});
