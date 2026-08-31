import { describe, expect, it } from "vitest";

import { adaptGuandanClientMessage } from "../../frontend/src/guandanCompatibilityAdapter";
import type { GuandanClientMessage } from "../../frontend/src/guandanProtocol";

const joinMessage: GuandanClientMessage = {
  type: "join",
  room: "0001",
  name: "测试玩家1",
};

describe("approved GuandanTable compatibility adapter matrix", () => {
  it.each([4, 6, 8, 10, 12, 14])(
    "translates the legacy join message to clean-room %i-player protocol",
    (playerCount) => {
      expect(
        adaptGuandanClientMessage(joinMessage, {
          cleanroom: true,
          room: "cleanroom-room-42",
          playerCount,
        }),
      ).toEqual({
        ...joinMessage,
        room: "cleanroom-room-42",
        player_count: playerCount,
      });
    },
  );

  it("keeps the original GuandanTable room when the clean-room room alias is empty", () => {
    expect(
      adaptGuandanClientMessage(joinMessage, {
        cleanroom: true,
        room: "   ",
        playerCount: 4,
      }),
    ).toEqual({
      ...joinMessage,
      player_count: 4,
    });
  });

  it("falls back to four players for an unsupported clean-room player count", () => {
    expect(
      adaptGuandanClientMessage(joinMessage, {
        cleanroom: true,
        room: "cleanroom-room-42",
        playerCount: 5,
      }),
    ).toEqual({
      ...joinMessage,
      room: "cleanroom-room-42",
      player_count: 4,
    });
  });

  it("does not rewrite legacy GuandanTable messages outside clean-room mode", () => {
    expect(
      adaptGuandanClientMessage(joinMessage, {
        cleanroom: false,
        room: "cleanroom-room-42",
        playerCount: 14,
      }),
    ).toBe(joinMessage);
  });

  it("does not rewrite non-join GuandanTable commands", () => {
    const playMessage: GuandanClientMessage = {
      type: "play",
      card_indexes: [0, 3],
    };

    expect(
      adaptGuandanClientMessage(playMessage, {
        cleanroom: true,
        room: "cleanroom-room-42",
        playerCount: 14,
      }),
    ).toBe(playMessage);
  });
});
