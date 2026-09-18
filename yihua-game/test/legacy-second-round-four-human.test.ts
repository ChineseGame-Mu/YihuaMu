import { describe, expect, test } from "vitest";

import { mandatoryTributeCard } from "../src/core/competition.js";
import { completeRound } from "../src/core/game-state.js";
import { attachLegacyGuandanConnection } from "../src/core/legacy-guandan-gateway.js";
import { isLegalReturnTributeCard } from "../src/core/native-tribute.js";
import { createServerRuntime } from "../src/core/server-runtime.js";
import type { TextSocket } from "../src/core/websocket-service.js";
import type { UpgradedConnection } from "../src/core/websocket-upgrade.js";

type LegacyMessage = Record<string, any>;

class FakeConnection implements UpgradedConnection {
  readonly messages: LegacyMessage[] = [];
  readonly context = { roomId: "__legacy_guandan_pending__" };
  private textHandler: ((text: string) => void | Promise<void>) | undefined;

  readonly socket: TextSocket = {
    send: async (text: string): Promise<void> => {
      this.messages.push(JSON.parse(text) as LegacyMessage);
    },
  };

  onText(handler: (text: string) => void | Promise<void>): void {
    this.textHandler = handler;
  }

  onClose(_handler: () => void | Promise<void>): void {}

  async send(message: Record<string, unknown>): Promise<void> {
    if (this.textHandler === undefined)
      throw new Error("connection is not attached");
    await this.textHandler(JSON.stringify(message));
  }

  latest(type: string): LegacyMessage {
    const message = this.messages
      .filter((candidate) => candidate.type === type)
      .at(-1);
    if (message === undefined) throw new Error(`expected ${type} message`);
    return message;
  }

  errorsSince(index: number): LegacyMessage[] {
    return this.messages
      .slice(index)
      .filter((message) => message.type === "error");
  }
}

const cardKey = (card: any): string => JSON.stringify(card);

const legacyCard = (card: any): any =>
  card.kind === "joker"
    ? { Joker: card.size === "small" ? "Small" : "Big" }
    : {
        Suited: {
          suit:
            card.suit === "clubs"
              ? "Clubs"
              : card.suit === "diamonds"
                ? "Diamonds"
                : card.suit === "hearts"
                  ? "Hearts"
                  : "Spades",
          rank:
            card.rank === "2"
              ? "Two"
              : card.rank === "3"
                ? "Three"
                : card.rank === "4"
                  ? "Four"
                  : card.rank === "5"
                    ? "Five"
                    : card.rank === "6"
                      ? "Six"
                      : card.rank === "7"
                        ? "Seven"
                        : card.rank === "8"
                          ? "Eight"
                          : card.rank === "9"
                            ? "Nine"
                            : card.rank === "10"
                              ? "Ten"
                              : card.rank === "J"
                                ? "Jack"
                                : card.rank === "Q"
                                  ? "Queen"
                                  : card.rank === "K"
                                    ? "King"
                                    : "Ace",
        },
      };

describe("four-human second-round handoff", () => {
  test("shows the promoted level, redeals every private hand, completes tribute, and lets the loser lead", async () => {
    const runtime = createServerRuntime();
    const clients = Array.from({ length: 4 }, () => new FakeConnection());
    for (const client of clients)
      await attachLegacyGuandanConnection(runtime, client);
    for (let seat = 0; seat < 4; seat += 1) {
      await clients[seat]!.send({
        type: "join",
        room: "round-two-qa",
        name: `真人${seat + 1}`,
        player_count: 4,
        desired_seat: seat,
      });
    }
    await clients[0]!.send({ type: "start", player_count: 4 });

    const started = runtime.rooms.get("round-two-qa");
    if (started.game.phase !== "playing") throw new Error("game did not start");
    const finishOrder = [0, 1, 2, 3] as const;
    const completed = completeRound(
      { ...started.game, finishedSeats: finishOrder },
      finishOrder[0],
    );
    runtime.rooms.set("round-two-qa", { ...started, game: completed });
    await runtime.websocket.broadcastGameState(
      runtime.rooms.get("round-two-qa"),
    );

    await clients[1]!.send({
      type: "shuffle_next_round",
      from_position: null,
      to_position: null,
    });
    await clients[0]!.send({ type: "deal_next_round" });

    const dealt = runtime.rooms.get("round-two-qa");
    if (dealt.game.phase !== "playing")
      throw new Error("second round was not dealt");
    expect(dealt.game.levelRank).toBe("4");
    for (const client of clients) {
      expect(client.latest("state").level).toBe("Four");
      expect(client.latest("hand").cards).toHaveLength(27);
    }

    const giver = 3;
    const receiver = 0;
    const tribute = mandatoryTributeCard(dealt.game.hands[giver]!, "4");
    const returned = dealt.game.hands[receiver]!.find(({ card }) =>
      isLegalReturnTributeCard(card, "4"),
    );
    if (returned === undefined)
      throw new Error("winner has no legal return card");

    const giverCards = clients[giver]!.latest("hand").cards as any[];
    const tributeIndex = giverCards.findIndex(
      (card) => cardKey(card) === cardKey(legacyCard(tribute.card)),
    );
    const tributeStart = clients[giver]!.messages.length;
    await clients[giver]!.send({
      type: "tribute_card",
      card_index: tributeIndex,
    });
    expect(clients[giver]!.errorsSince(tributeStart)).toEqual([]);

    const receiverCards = clients[receiver]!.latest("hand").cards as any[];
    const returnIndex = receiverCards.findIndex(
      (card) => cardKey(card) === cardKey(legacyCard(returned.card)),
    );
    const returnStart = clients[receiver]!.messages.length;
    await clients[receiver]!.send({
      type: "return_tribute",
      card_index: returnIndex,
    });
    expect(clients[receiver]!.errorsSince(returnStart)).toEqual([]);

    const finalized = runtime.rooms.get("round-two-qa");
    expect(finalized.tribute).toBeUndefined();
    if (finalized.game.phase !== "playing") {
      throw new Error("tribute completion left the playing phase");
    }
    expect(finalized.game.hands.map((hand) => hand.length)).toEqual([
      27, 27, 27, 27,
    ]);
    expect(finalized.game.currentTurn).toBe(giver);

    const playStart = clients[giver]!.messages.length;
    await clients[giver]!.send({ type: "play", card_indexes: [0] });
    expect(clients[giver]!.errorsSince(playStart)).toEqual([]);
    const afterPlay = runtime.rooms.get("round-two-qa");
    if (afterPlay.game.phase !== "playing")
      throw new Error("play ended the round");
    expect(afterPlay.game.hands[giver]).toHaveLength(26);
  }, 15_000);
});
