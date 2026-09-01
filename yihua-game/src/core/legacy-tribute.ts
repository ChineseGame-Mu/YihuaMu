import type { DeckCard } from "./deck.js";
import type { LegacyServerMessage } from "./frontend-compat.js";
import type { ServerRuntime } from "./server-runtime.js";

export type LegacyTributePlan =
  | { readonly Single: { readonly giver: number; readonly receiver: number } }
  | {
      readonly Double: {
        readonly givers: readonly [number, number];
        readonly receivers: readonly [number, number];
      };
    };

type LegacyStateMessage = Extract<
  LegacyServerMessage,
  { readonly type: "state" }
>;

interface TributePair {
  readonly giver: number;
  readonly receiver: number;
  tributeCardId?: string;
  returnCardId?: string;
}

interface TributeSession {
  readonly pairs: TributePair[];
  readonly plan: LegacyTributePlan;
}

const sessions = new Map<string, TributeSession>();

export const prepareLegacyTribute = (
  roomId: string,
  finishOrder: readonly number[],
): void => {
  if (finishOrder.length !== 4) {
    sessions.delete(roomId);
    return;
  }

  const first = finishOrder[0]!;
  const second = finishOrder[1]!;
  const third = finishOrder[2]!;
  const last = finishOrder[3]!;
  const doubleDown = first % 2 === second % 2;

  if (doubleDown) {
    sessions.set(roomId, {
      pairs: [
        { giver: last, receiver: first },
        { giver: third, receiver: second },
      ],
      plan: {
        Double: {
          givers: [last, third],
          receivers: [first, second],
        },
      },
    });
    return;
  }

  sessions.set(roomId, {
    pairs: [{ giver: last, receiver: first }],
    plan: { Single: { giver: last, receiver: first } },
  });
};

export const legacyTributePlan = (roomId: string): LegacyTributePlan | null =>
  sessions.get(roomId)?.plan ?? null;

export const hasPendingLegacyTribute = (roomId: string): boolean =>
  sessions.has(roomId);

const moveCard = (
  hands: readonly (readonly DeckCard[])[],
  fromSeat: number,
  toSeat: number,
  cardId: string,
): readonly (readonly DeckCard[])[] => {
  const fromHand = hands[fromSeat];
  const toHand = hands[toSeat];
  if (fromHand === undefined || toHand === undefined) {
    throw new Error("tribute seat is outside the table");
  }
  const card = fromHand.find(({ id }) => id === cardId);
  if (card === undefined) {
    throw new Error("selected tribute card is not in hand");
  }

  return hands.map((hand, seat) => {
    if (seat === fromSeat) return hand.filter(({ id }) => id !== cardId);
    if (seat === toSeat) return [...hand, card];
    return hand;
  });
};

const allTributesReceived = (session: TributeSession): boolean =>
  session.pairs.every(({ tributeCardId }) => tributeCardId !== undefined);

const allReturnsReceived = (session: TributeSession): boolean =>
  session.pairs.every(({ returnCardId }) => returnCardId !== undefined);

export const applyLegacyTributeSelection = async (
  runtime: ServerRuntime,
  roomId: string,
  seat: number,
  cardId: string,
  kind: "tribute_card" | "return_tribute",
): Promise<void> => {
  const session = sessions.get(roomId);
  if (session === undefined) {
    throw new Error("no tribute exchange is pending");
  }

  const managed = runtime.rooms.get(roomId);
  if (managed.game.phase !== "playing") {
    throw new Error("tribute exchange requires the next round to be dealt");
  }

  if (kind === "tribute_card") {
    const pair = session.pairs.find(({ giver }) => giver === seat);
    if (pair === undefined) {
      throw new Error("this player does not owe tribute");
    }
    if (pair.tributeCardId !== undefined) {
      throw new Error("tribute already submitted");
    }

    const next = runtime.rooms.set(roomId, {
      ...managed,
      game: {
        ...managed.game,
        hands: moveCard(managed.game.hands, pair.giver, pair.receiver, cardId),
      },
    });
    pair.tributeCardId = cardId;
    await runtime.websocket.broadcastGameState(next);
    await runtime.websocket.sendPrivateHands(next);
    return;
  }

  if (!allTributesReceived(session)) {
    throw new Error(
      "all tribute cards must be submitted before return tribute",
    );
  }
  const pair = session.pairs.find(({ receiver }) => receiver === seat);
  if (pair === undefined) {
    throw new Error("this player does not owe return tribute");
  }
  if (pair.returnCardId !== undefined) {
    throw new Error("return tribute already submitted");
  }

  const next = runtime.rooms.set(roomId, {
    ...managed,
    game: {
      ...managed.game,
      hands: moveCard(managed.game.hands, pair.receiver, pair.giver, cardId),
    },
  });
  pair.returnCardId = cardId;
  if (allReturnsReceived(session)) sessions.delete(roomId);
  await runtime.websocket.broadcastGameState(next);
  await runtime.websocket.sendPrivateHands(next);
};

export const decorateLegacyTributeState = (
  roomId: string,
  state: LegacyStateMessage,
): LegacyStateMessage =>
  ({
    ...state,
    pending_tribute: legacyTributePlan(roomId),
  }) as unknown as LegacyStateMessage;
