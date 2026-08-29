import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../src/core/cards.js";
import { canHandBeat, classifyHand } from "../src/core/hand.js";
import { createLobbyState } from "../src/core/game-state.js";
import { transitionGame } from "../src/core/game-machine.js";

const card = (rank: Rank, suit: Suit = "clubs"): Card => ({
  kind: "suited",
  rank,
  suit,
});

const joker = (size: "small" | "big"): Card => ({ kind: "joker", size });

describe("complete hand and table-state matrix", () => {
  it.each([
    [[card("7")], "single"],
    [[card("7"), card("7", "hearts")], "pair"],
    [[card("7"), card("7", "hearts"), card("7", "spades")], "triple"],
    [
      [card("7"), card("7", "hearts"), card("7", "spades"), card("8"), card("8", "hearts")],
      "full-house",
    ],
    [[card("3"), card("4"), card("5"), card("6"), card("7")], "straight"],
    [
      [card("3", "hearts"), card("4", "hearts"), card("5", "hearts"), card("6", "hearts"), card("7", "hearts")],
      "straight-flush",
    ],
    [[card("3"), card("3", "hearts"), card("4"), card("4", "hearts"), card("5"), card("5", "hearts")], "consecutive-pairs"],
    [[card("3"), card("3", "hearts"), card("3", "spades"), card("4"), card("4", "hearts"), card("4", "spades")], "consecutive-triples"],
    [[card("9"), card("9", "hearts"), card("9", "spades"), card("9", "diamonds")], "bomb"],
    [[joker("small"), joker("small"), joker("big"), joker("big")], "joker-bomb"],
  ] as const)("classifies %j as %s", (cards, kind) => {
    expect(classifyHand(cards).kind).toBe(kind);
  });

  it("covers wheel straights and rejects straights containing rank 2", () => {
    expect(classifyHand([card("A"), card("2"), card("3"), card("4"), card("5")])).toMatchObject({
      kind: "straight",
      highRank: "5",
    });
    expect(classifyHand([card("2"), card("3"), card("4"), card("5"), card("6")]).kind).toBe("invalid");
  });

  it("orders bomb families across normal, straight-flush, six-card, and joker bombs", () => {
    const four = classifyHand([card("8"), card("8", "hearts"), card("8", "spades"), card("8", "diamonds")]);
    const five = classifyHand([card("7"), card("7", "hearts"), card("7", "spades"), card("7", "diamonds"), card("7")]);
    const straightFlush = classifyHand([
      card("3", "hearts"),
      card("4", "hearts"),
      card("5", "hearts"),
      card("6", "hearts"),
      card("7", "hearts"),
    ]);
    const six = classifyHand([
      card("6"),
      card("6", "hearts"),
      card("6", "spades"),
      card("6", "diamonds"),
      card("6"),
      card("6", "hearts"),
    ]);
    const jokers = classifyHand([joker("small"), joker("small"), joker("big"), joker("big")]);

    expect(canHandBeat(five, four)).toBe(true);
    expect(canHandBeat(straightFlush, five)).toBe(true);
    expect(canHandBeat(six, straightFlush)).toBe(true);
    expect(canHandBeat(jokers, six)).toBe(true);
  });

  it("keeps first-round opening draw as an explicit table-machine phase", () => {
    const lobby = createLobbyState(4, 0);
    const opening = transitionGame(lobby, { type: "begin-opening-draw" }, () => 0.5);

    expect(opening.phase).toBe("opening-draw");
    if (opening.phase !== "opening-draw") throw new Error("expected opening-draw phase");
    expect(opening.openingDraw.attempts.length).toBeGreaterThan(0);
    expect(opening.openingDraw.winnerSeat).toBeGreaterThanOrEqual(0);

    const playing = transitionGame(opening, { type: "deal-after-opening-draw" }, () => 0.25);
    expect(playing.phase).toBe("playing");
    if (playing.phase !== "playing") throw new Error("expected playing phase");
    expect(playing.currentTurn).toBe(opening.openingDraw.winnerSeat);
    expect(playing.hands).toHaveLength(4);
    expect(playing.hands.every((hand) => hand.length === 27)).toBe(true);
  });

  it("rejects table-machine actions that are illegal for the current phase", () => {
    const lobby = createLobbyState(4, 0);
    expect(() => transitionGame(lobby, { type: "next-round" }, () => 0.5)).toThrow(
      "cannot next-round while game is lobby",
    );
  });
});
