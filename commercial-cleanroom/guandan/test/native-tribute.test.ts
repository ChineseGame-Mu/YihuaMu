import { describe, expect, it } from "vitest";
import type { Rank } from "../src/core/cards.js";
import type { DeckCard } from "../src/core/deck.js";
import { createLobbyState, startGame } from "../src/core/game-state.js";
import {
  prepareNativeTribute,
  submitNativeReturnTribute,
  submitNativeTribute,
} from "../src/core/native-tribute.js";
import { parseClientMessage } from "../src/core/protocol.js";
import { buildRoundPlacements } from "../src/core/round-result.js";
import type { ManagedRoom } from "../src/core/room-manager.js";
import { createRoom } from "../src/core/room.js";
import { createRuntimeSnapshot } from "../src/core/runtime-snapshot.js";

const suited = (
  id: string,
  rank: Rank,
  suit: "clubs" | "diamonds" | "hearts" | "spades" = "clubs",
): DeckCard => ({ id, copy: 0, card: { kind: "suited", rank, suit } });

const big = (id: string): DeckCard => ({
  id,
  copy: 0,
  card: { kind: "joker", size: "big" },
});

const gameWithHands = (hands: DeckCard[][], levelRank: Rank = "10") => ({
  ...startGame(createLobbyState(4, 0), () => 0.5),
  hands,
  levelRank,
});

const ids = (hands: readonly (readonly DeckCard[])[]): string[] =>
  hands.flatMap((hand) => hand.map(({ id }) => id)).sort();

describe("native competitive tribute state machine", () => {
  it("runs single tribute -> return -> play-ready and conserves cards", () => {
    const game = gameWithHands([
      [suited("p0-return", "3"), suited("p0-x", "4")],
      [suited("p1", "5")],
      [suited("p2", "6")],
      [suited("p3-low", "K"), suited("p3-high", "A")],
    ]);
    const before = ids(game.hands);
    const placements = buildRoundPlacements(4, [0, 1, 2, 3]);
    const prepared = prepareNativeTribute(placements, game);
    expect(prepared.kind).toBe("single");
    expect(prepared.status).toBe("tribute");
    expect(prepared.pendingTributeSeats).toEqual([3]);

    expect(() =>
      submitNativeTribute(game, prepared, 3, "p3-low"),
    ).toThrow(/highest eligible/);

    const paid = submitNativeTribute(game, prepared, 3, "p3-high");
    expect(paid.tribute.status).toBe("return");
    expect(paid.tribute.pendingReturnSeats).toEqual([0]);
    expect(paid.game.hands[3]?.map(({ id }) => id)).not.toContain("p3-high");

    const finished = submitNativeReturnTribute(
      paid.game,
      paid.tribute,
      0,
      "p0-return",
    );
    expect(finished.tribute.status).toBe("complete");
    expect(finished.game.currentTurn).toBe(3);
    expect(finished.game.trick.leaderSeat).toBe(3);
    expect(ids(finished.game.hands)).toEqual(before);
    expect(finished.game.hands[0]?.map(({ id }) => id)).toContain("p3-high");
    expect(finished.game.hands[3]?.map(({ id }) => id)).toContain("p0-return");
  });

  it("excludes heart-level wildcard from mandatory tribute", () => {
    const game = gameWithHands([
      [suited("p0-return", "3")],
      [suited("p1", "4")],
      [suited("p2", "5")],
      [suited("wild", "10", "hearts"), suited("ace", "A")],
    ]);
    const tribute = prepareNativeTribute(
      buildRoundPlacements(4, [0, 1, 2, 3]),
      game,
    );
    expect(() => submitNativeTribute(game, tribute, 3, "wild")).toThrow(
      /highest eligible/,
    );
    expect(submitNativeTribute(game, tribute, 3, "ace").tribute.status).toBe(
      "return",
    );
  });

  it("recognizes combined two-big-joker anti-tribute without card movement", () => {
    const game = gameWithHands([
      [suited("p0", "3")],
      [big("p1-big")],
      [suited("p2", "4")],
      [big("p3-big")],
    ]);
    const tribute = prepareNativeTribute(
      buildRoundPlacements(4, [0, 2, 1, 3]),
      game,
    );
    expect(tribute.kind).toBe("anti-tribute");
    expect(tribute.status).toBe("complete");
    expect(tribute.pendingTributeSeats).toEqual([]);
  });

  it("parses native tribute websocket commands and rejects empty card ids", () => {
    expect(
      parseClientMessage(
        JSON.stringify({
          type: "tribute_card",
          cardId: "c1",
          expectedRevision: 7,
        }),
      ),
    ).toMatchObject({ type: "tribute_card", cardId: "c1", expectedRevision: 7 });
    expect(
      parseClientMessage(
        JSON.stringify({ type: "return_tribute", cardId: "c2" }),
      ),
    ).toMatchObject({ type: "return_tribute", cardId: "c2" });
    expect(() =>
      parseClientMessage(JSON.stringify({ type: "tribute_card", cardId: "" })),
    ).toThrow(/non-empty cardId/);
  });

  it("persists an in-progress tribute exchange in runtime snapshots", () => {
    const game = gameWithHands([
      [suited("p0", "3")],
      [suited("p1", "4")],
      [suited("p2", "5")],
      [suited("p3", "A")],
    ]);
    const tribute = prepareNativeTribute(
      buildRoundPlacements(4, [0, 1, 2, 3]),
      game,
    );
    const managed: ManagedRoom = {
      room: createRoom("native-tribute", 4),
      game,
      revision: 12,
      tribute,
    };
    const snapshot = createRuntimeSnapshot([managed]);
    expect(snapshot.rooms[0]?.tribute).toEqual(tribute);
  });
});
