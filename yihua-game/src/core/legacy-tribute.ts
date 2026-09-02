import { RANKS, type Card, type Rank } from "./cards.js";
import type { DeckCard } from "./deck.js";
import type { LegacyServerMessage } from "./frontend-compat.js";
import type { ManagedRoom } from "./room-manager.js";
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

interface TributeSelection {
  readonly player: number;
  readonly card: DeckCard;
}

interface TributeSession {
  readonly plan: LegacyTributePlan;
  readonly tributeCards: TributeSelection[];
  readonly returnCards: TributeSelection[];
}

const sessions = new Map<string, TributeSession>();
const resistedRooms = new Map<string, boolean>();

export const prepareLegacyTribute = (
  roomId: string,
  finishOrder: readonly number[],
): void => {
  resistedRooms.set(roomId, false);
  if (finishOrder.length !== 4) {
    sessions.delete(roomId);
    return;
  }

  const first = finishOrder[0]!;
  const second = finishOrder[1]!;
  const third = finishOrder[2]!;
  const last = finishOrder[3]!;
  const doubleDown = first % 2 === second % 2;

  sessions.set(
    roomId,
    doubleDown
      ? {
          plan: {
            Double: {
              givers: [third, last],
              receivers: [first, second],
            },
          },
          tributeCards: [],
          returnCards: [],
        }
      : {
          plan: { Single: { giver: last, receiver: first } },
          tributeCards: [],
          returnCards: [],
        },
  );
};

export const legacyTributePlan = (roomId: string): LegacyTributePlan | null =>
  sessions.get(roomId)?.plan ?? null;

export const hasPendingLegacyTribute = (roomId: string): boolean =>
  sessions.has(roomId);

export const legacyTributeResisted = (roomId: string): boolean =>
  resistedRooms.get(roomId) ?? false;

const tributeGivers = (plan: LegacyTributePlan): readonly number[] =>
  "Single" in plan ? [plan.Single.giver] : plan.Double.givers;

const tributeReceivers = (plan: LegacyTributePlan): readonly number[] =>
  "Single" in plan ? [plan.Single.receiver] : plan.Double.receivers;

const countBigJokers = (hand: readonly DeckCard[]): number =>
  hand.filter(({ card }) => card.kind === "joker" && card.size === "big")
    .length;

export const resolveLegacyTributeResistance = (
  roomId: string,
  managed: ManagedRoom,
): boolean => {
  const session = sessions.get(roomId);
  if (session === undefined || managed.game.phase !== "playing") return false;
  const givers = tributeGivers(session.plan);
  const bigJokers = givers.reduce(
    (total, seat) => total + countBigJokers(managed.game.hands[seat] ?? []),
    0,
  );
  if (bigJokers < 2) return false;
  sessions.delete(roomId);
  resistedRooms.set(roomId, true);
  return true;
};

const isWildLevelCard = (card: Card, level: Rank): boolean =>
  card.kind === "suited" && card.suit === "hearts" && card.rank === level;

const singleStrength = (card: Card, level: Rank): number => {
  if (card.kind === "joker") {
    return RANKS.length + 2 + (card.size === "big" ? 1 : 0);
  }
  if (card.rank === level) return RANKS.length + 1;
  return RANKS.indexOf(card.rank);
};

const legalTributeCard = (
  hand: readonly DeckCard[],
  cardId: string,
  level: Rank,
): DeckCard => {
  const selected = hand.find(({ id }) => id === cardId);
  if (selected === undefined) {
    throw new Error("selected tribute card is not in hand");
  }
  if (isWildLevelCard(selected.card, level)) {
    throw new Error("heart level card cannot be paid as tribute");
  }
  const selectedStrength = singleStrength(selected.card, level);
  const hasHigherEligibleCard = hand.some(
    ({ card }) =>
      !isWildLevelCard(card, level) &&
      singleStrength(card, level) > selectedStrength,
  );
  if (hasHigherEligibleCard) {
    throw new Error("tribute must be the highest eligible card in hand");
  }
  return selected;
};

const legalReturnCard = (card: Card, level: Rank): boolean => {
  if (card.kind !== "suited" || card.rank === level) return false;
  return RANKS.indexOf(card.rank) <= RANKS.indexOf("10");
};

const removeCard = (
  hands: readonly (readonly DeckCard[])[],
  seat: number,
  cardId: string,
): readonly (readonly DeckCard[])[] =>
  hands.map((hand, index) =>
    index === seat ? hand.filter(({ id }) => id !== cardId) : hand,
  );

const addCard = (
  hands: readonly (readonly DeckCard[])[],
  seat: number,
  card: DeckCard,
): readonly (readonly DeckCard[])[] =>
  hands.map((hand, index) => (index === seat ? [...hand, card] : hand));

const withHands = (
  managed: ManagedRoom,
  hands: readonly (readonly DeckCard[])[],
): ManagedRoom => {
  if (managed.game.phase !== "playing") {
    throw new Error("tribute exchange requires the next round to be dealt");
  }
  return { ...managed, game: { ...managed.game, hands } };
};

const allTributesReceived = (session: TributeSession): boolean =>
  session.tributeCards.length === tributeGivers(session.plan).length;

const allReturnsReceived = (session: TributeSession): boolean =>
  session.returnCards.length === tributeReceivers(session.plan).length;

const selectionFor = (
  selections: readonly TributeSelection[],
  player: number,
): TributeSelection => {
  const found = selections.find((selection) => selection.player === player);
  if (found === undefined)
    throw new Error("tribute exchange selection is missing");
  return found;
};

const finalizeExchange = (
  managed: ManagedRoom,
  session: TributeSession,
): ManagedRoom => {
  if (managed.game.phase !== "playing") {
    throw new Error("tribute exchange requires the next round to be dealt");
  }

  let hands = managed.game.hands;
  let leadSeat: number;
  if ("Single" in session.plan) {
    const { giver, receiver } = session.plan.Single;
    const tribute = selectionFor(session.tributeCards, giver).card;
    const returned = selectionFor(session.returnCards, receiver).card;
    hands = addCard(hands, receiver, tribute);
    hands = addCard(hands, giver, returned);
    leadSeat = giver;
  } else {
    const { givers, receivers } = session.plan.Double;
    const first = selectionFor(session.tributeCards, givers[0]);
    const second = selectionFor(session.tributeCards, givers[1]);
    const firstStrength = singleStrength(
      first.card.card,
      managed.game.levelRank ?? "2",
    );
    const secondStrength = singleStrength(
      second.card.card,
      managed.game.levelRank ?? "2",
    );
    const [high, low] =
      secondStrength > firstStrength ? [second, first] : [first, second];
    const firstReturn = selectionFor(session.returnCards, receivers[0]).card;
    const secondReturn = selectionFor(session.returnCards, receivers[1]).card;

    hands = addCard(hands, receivers[0], high.card);
    hands = addCard(hands, high.player, firstReturn);
    hands = addCard(hands, receivers[1], low.card);
    hands = addCard(hands, low.player, secondReturn);
    leadSeat = high.player;
  }

  return {
    ...managed,
    game: {
      ...managed.game,
      hands,
      currentTurn: leadSeat,
      trick: {
        ...managed.game.trick,
        currentTurn: leadSeat,
        leaderSeat: leadSeat,
      },
    },
  };
};

export const applyLegacyTributeSelection = async (
  runtime: ServerRuntime,
  roomId: string,
  seat: number,
  cardId: string,
  kind: "tribute_card" | "return_tribute",
): Promise<void> => {
  const session = sessions.get(roomId);
  if (session === undefined) throw new Error("no tribute exchange is pending");
  const managed = runtime.rooms.get(roomId);
  if (managed.game.phase !== "playing") {
    throw new Error("tribute exchange requires the next round to be dealt");
  }
  const level = managed.game.levelRank ?? "2";

  if (kind === "tribute_card") {
    if (!tributeGivers(session.plan).includes(seat)) {
      throw new Error("this player is not required to pay tribute");
    }
    if (session.tributeCards.some(({ player }) => player === seat)) {
      throw new Error("this player has already submitted a tribute card");
    }
    const card = legalTributeCard(
      managed.game.hands[seat] ?? [],
      cardId,
      level,
    );
    session.tributeCards.push({ player: seat, card });
    const next = runtime.rooms.set(
      roomId,
      withHands(managed, removeCard(managed.game.hands, seat, cardId)),
    );
    await runtime.websocket.broadcastGameState(next);
    await runtime.websocket.sendPrivateHands(next);
    return;
  }

  if (!allTributesReceived(session)) {
    throw new Error("all tribute cards must be submitted before return cards");
  }
  if (!tributeReceivers(session.plan).includes(seat)) {
    throw new Error("this player is not required to return a card");
  }
  if (session.returnCards.some(({ player }) => player === seat)) {
    throw new Error("this player has already submitted a return card");
  }
  const hand = managed.game.hands[seat] ?? [];
  const selected = hand.find(({ id }) => id === cardId);
  if (selected === undefined)
    throw new Error("selected return card is not in hand");
  if (!legalReturnCard(selected.card, level)) {
    throw new Error(
      "return card must be a non-level suited card ranked 2 through 10",
    );
  }

  session.returnCards.push({ player: seat, card: selected });
  let nextManaged = withHands(
    managed,
    removeCard(managed.game.hands, seat, cardId),
  );
  if (allReturnsReceived(session)) {
    nextManaged = finalizeExchange(nextManaged, session);
    sessions.delete(roomId);
  }
  const next = runtime.rooms.set(roomId, nextManaged);
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
    tribute_resisted: legacyTributeResisted(roomId),
  }) as unknown as LegacyStateMessage;
