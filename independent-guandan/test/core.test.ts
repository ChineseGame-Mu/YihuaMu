import { describe, expect, it } from "vitest";

import {
  determineUniqueOpeningWinner,
  type Card,
} from "../src/core/cards.js";
import { robotDelayMs } from "../src/core/robot.js";
import {
  CARDS_PER_PLAYER,
  createTableConfig,
  SUPPORTED_PLAYER_COUNTS,
  teamForSeat,
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
});

describe("opening draw", () => {
  const card = (rank: Card extends infer _ ? any : never, suit: any): Card => ({
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
