import { describe, expect, test } from "vitest";

import { mandatoryTributeCard } from "../src/core/competition.js";
import { attachLegacyGuandanConnection } from "../src/core/legacy-guandan-gateway.js";
import { prepareLegacyTribute } from "../src/core/legacy-tribute.js";
import { isLegalReturnTributeCard } from "../src/core/native-tribute.js";
import { createServerRuntime } from "../src/core/server-runtime.js";
import type { TextSocket } from "../src/core/websocket-service.js";
import type { UpgradedConnection } from "../src/core/websocket-upgrade.js";

type LegacyMessage = Record<string, any>;

class FakeConnection implements UpgradedConnection {
  readonly messages: LegacyMessage[] = [];
  readonly context = { roomId: "__legacy_guandan_pending__" };
  private textHandler: ((text: string) => void | Promise<void>) | undefined;
  private closeHandler: (() => void | Promise<void>) | undefined;

  readonly socket: TextSocket = {
    send: async (text: string): Promise<void> => {
      this.messages.push(JSON.parse(text) as LegacyMessage);
    },
  };

  onText(handler: (text: string) => void | Promise<void>): void {
    this.textHandler = handler;
  }

  onClose(handler: () => void | Promise<void>): void {
    this.closeHandler = handler;
  }

  async send(message: Record<string, unknown>): Promise<void> {
    if (this.textHandler === undefined) throw new Error("connection is not attached");
    await this.textHandler(JSON.stringify(message));
  }

  states(): LegacyMessage[] {
    return this.messages.filter((message) => message.type === "state");
  }

  hands(): LegacyMessage[] {
    return this.messages.filter((message) => message.type === "hand");
  }

  errorsSince(index: number): LegacyMessage[] {
    return this.messages
      .slice(index)
      .filter((message) => message.type === "error");
  }
}

const last = <T>(values: T[]): T => {
  const value = values.at(-1);
  if (value === undefined) throw new Error("expected a captured value");
  return value;
};

const cardKey = (card: any): string => JSON.stringify(card);

const indexOfLegacyCard = (cards: any[], target: any): number =>
  cards.findIndex((card) => cardKey(card) === cardKey(target));

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

describe("2026-09-16 four-human tribute acceptance", () => {
  test(
    "tribute -> all four see -> return -> all four see -> exchange -> clear -> loser leads and can play",
    async () => {
      const runtime = createServerRuntime();
      const clients = Array.from({ length: 4 }, () => new FakeConnection());
      for (const client of clients) await attachLegacyGuandanConnection(runtime, client);

      for (let seat = 0; seat < 4; seat += 1) {
        await clients[seat]!.send({
          type: "join",
          room: "0916-tribute-qa",
          name: `真人${seat + 1}`,
          player_count: 4,
          desired_seat: seat,
        });
      }
      await clients[0]!.send({ type: "start", player_count: 4 });

      let managed = runtime.rooms.get("0916-tribute-qa");
      if (managed.game.phase !== "playing") throw new Error("game did not start");
      const level = managed.game.levelRank ?? "2";
      const giver = 3;
      const receiver = 0;
      const tributeCard = mandatoryTributeCard(managed.game.hands[giver]!, level);
      const returnCard = managed.game.hands[receiver]!.find(({ card }) =>
        isLegalReturnTributeCard(card, level),
      );
      if (returnCard === undefined) throw new Error("test hand has no legal return card");

      managed = runtime.rooms.set("0916-tribute-qa", {
        ...managed,
        tribute: {
          kind: "single",
          transfers: [{ fromSeat: giver, toSeat: receiver }],
          status: "tribute",
          pendingTributeSeats: [giver],
          pendingReturnSeats: [],
          tributeCards: [],
          returnCards: [],
          leadSeat: receiver,
        },
        game: {
          ...managed.game,
          currentTurn: receiver,
          trick: {
            ...managed.game.trick,
            leaderSeat: receiver,
            currentTurn: receiver,
            leadingPlay: null,
            plays: [],
            passedSeats: [],
          },
        },
      });
      prepareLegacyTribute("0916-tribute-qa", [0, 1, 2, 3]);
      await runtime.websocket.broadcastGameState(managed);
      await runtime.websocket.sendPrivateHands(managed);

      const giverHandBefore = last(clients[giver]!.hands()).cards as any[];
      const tributeIndex = indexOfLegacyCard(giverHandBefore, legacyCard(tributeCard.card));
      expect(tributeIndex).toBeGreaterThanOrEqual(0);
      await clients[giver]!.send({ type: "tribute_card", card_index: tributeIndex });

      const tributeLegacy = legacyCard(tributeCard.card);
      for (const client of clients) {
        const visible = last(client.states()).table_plays as Array<{ player: number; cards: any[] }>;
        expect(visible.some((play) => play.player === giver && play.cards.some((card) => cardKey(card) === cardKey(tributeLegacy)))).toBe(true);
      }

      const receiverHandAfterTribute = last(clients[receiver]!.hands()).cards as any[];
      const returnIndex = indexOfLegacyCard(receiverHandAfterTribute, legacyCard(returnCard.card));
      expect(returnIndex).toBeGreaterThanOrEqual(0);
      await clients[receiver]!.send({ type: "return_tribute", card_index: returnIndex });

      const returnLegacy = legacyCard(returnCard.card);
      for (const client of clients) {
        const states = client.states();
        expect(
          states.some((state) =>
            (state.table_plays as Array<{ player: number; cards: any[] }>).some(
              (play) => play.player === receiver && play.cards.some((card) => cardKey(card) === cardKey(returnLegacy)),
            ),
          ),
        ).toBe(true);
        expect(last(states).table_plays).toEqual([]);
        expect(last(states).last_play).toEqual([]);
      }

      const finalized = runtime.rooms.get("0916-tribute-qa");
      expect(finalized.tribute).toBeUndefined();
      if (finalized.game.phase !== "playing") throw new Error("game left playing phase");
      expect(finalized.game.currentTurn).toBe(giver);
      expect(finalized.game.trick.leaderSeat).toBe(giver);
      expect(finalized.game.trick.leadingPlay).toBeNull();
      expect(finalized.game.hands[giver]).toHaveLength(27);
      expect(finalized.game.hands[receiver]).toHaveLength(27);
      expect(finalized.game.hands[giver]!.some(({ id }) => id === returnCard.id)).toBe(true);
      expect(finalized.game.hands[receiver]!.some(({ id }) => id === tributeCard.id)).toBe(true);

      await clients[giver]!.send({ type: "start_trick" });
      const giverHandAfterExchange = last(clients[giver]!.hands()).cards as any[];
      const beforePlayMessages = clients[giver]!.messages.length;
      await clients[giver]!.send({ type: "play", card_indexes: [0] });
      expect(clients[giver]!.errorsSince(beforePlayMessages)).toEqual([]);

      const afterPlay = runtime.rooms.get("0916-tribute-qa");
      if (afterPlay.game.phase !== "playing") throw new Error("play unexpectedly ended game");
      expect(afterPlay.game.hands[giver]).toHaveLength(giverHandAfterExchange.length - 1);
      expect(afterPlay.game.trick.leadingPlay?.seat).toBe(giver);
      for (const client of clients) {
        expect(
          last(client.states()).table_plays.some((play: any) => play.player === giver),
        ).toBe(true);
      }
    },
    15_000,
  );
});
