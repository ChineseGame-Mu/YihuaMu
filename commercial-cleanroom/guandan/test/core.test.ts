import { describe, expect, it } from "vitest";

import {
  determineUniqueOpeningWinner,
  type Card,
  type Rank,
  type Suit,
} from "../src/core/cards.js";
import { robotDelayMs } from "../src/core/robot.js";
import {
  CARDS_PER_PLAYER,
  createTableConfig,
  partnerSeatForFourPlayerTable,
  SUPPORTED_PLAYER_COUNTS,
  teamForSeat,
  teammateSeatsForSeat,
} from "../src/core/table.js";

describe("table configuration", () => {
  it("supports every required table size", () => {
    for (const playerCount of SUPPORTED_PLAYER_COUNTS) {
      const config = createTableConfig(playerCount, 3);
      expect(config.playerCount).toBe(playerCount);
      expect(config.cardsPerPlayer).toBe(CARDS_PER_PLAYER);
    }
  });

  it("rejects unsupported table sizes", () => {
    for (const playerCount of [2, 5, 7, 16]) {
      expect(() => createTableConfig(playerCount, 1)).toThrow();
    }
  });

  it("allows zero through three robots", () => {
    for (const botCount of [0, 1, 2, 3]) {
      expect(createTableConfig(14, botCount).botCount).toBe(botCount);
    }
    expect(() => createTableConfig(14, 4)).toThrow();
  });

  it("alternates teams by seat", () => {
    expect(teamForSeat(0)).toBe("A");
    expect(teamForSeat(1)).toBe("B");
    expect(teamForSeat(12)).toBe("A");
    expect(teamForSeat(13)).toBe("B");
  });

  it("maps four-player partners to the opposite seat", () => {
    expect(partnerSeatForFourPlayerTable(0)).toBe(2);
    expect(partnerSeatForFourPlayerTable(1)).toBe(3);
    expect(partnerSeatForFourPlayerTable(2)).toBe(0);
    expect(partnerSeatForFourPlayerTable(3)).toBe(1);
  });

  it("lists every same-team seat at larger tables", () => {
    expect(teammateSeatsForSeat(6, 0)).toEqual([2, 4]);
    expect(teammateSeatsForSeat(6, 3)).toEqual([1, 5]);
    expect(teammateSeatsForSeat(14, 12)).toEqual([0, 2, 4, 6, 8, 10]);
  });
});

describe("opening draw", () => {
  const card = (rank: Rank, suit: Suit): Card => ({
    kind: "suited",
    rank,
    suit,
  });

  it("returns the unique highest seat", () => {
    const draw: Card[] = [
      card("2", "clubs"),
      card("A", "hearts"),
      card("K", "hearts"),
      card("10", "spades"),
    ];
    expect(determineUniqueOpeningWinner(draw)).toBe(1);
  });

  it("rejects jokers in opening draw", () => {
    expect(() =>
      determineUniqueOpeningWinner([
        { kind: "joker", size: "small" },
        card("A", "hearts"),
      ]),
    ).toThrow();
  });
});

describe("robot timing", () => {
  it("stays inside the required 800–1800 ms window", () => {
    expect(robotDelayMs(() => 0)).toBe(800);
    expect(robotDelayMs(() => 0.999999)).toBe(1800);
  });
});
