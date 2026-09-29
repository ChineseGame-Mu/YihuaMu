import { RANKS, type Card, type Rank } from "./cards.js";
import type { DeckCard } from "./deck.js";
import { legacyCard, type LegacyServerMessage } from "./frontend-compat.js";
import { classifyHand } from "./hand.js";
import type { ManagedRoom } from "./room-manager.js";
import type { ServerRuntime } from "./server-runtime.js";
import {
  antiTributeBigJokerRequirement,
  isSupportedPlayerCount,
} from "./table.js";

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

export interface TributeSelection {
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
const PUBLIC_EXCHANGE_CARD_MS = 1200;

const sleep = async (milliseconds: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
};

export const prepareLegacyTribute = (
  roomId: string,
  finishOrder: readonly number[],
): void => {
  resistedRooms.set(roomId, false);
  if (!isSupportedPlayerCount(finishOrder.length)) {
    sessions.delete(roomId);
    return;
  }

  const first = finishOrder[0]!;
  const second = finishOrder[1]!;
  const doubleDown = first % 2 === second % 2;
  const losingFinishers = finishOrder.filter((seat) => seat % 2 !== first % 2);
  const last = losingFinishers.at(-1)!;
  const penultimate = losingFinishers.at(-2)!;

  sessions.set(
    roomId,
    doubleDown
      ? {
          plan: {
            Double: {
              givers: [penultimate, last],
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

export const runLegacyRobotTribute = async (
  runtime: ServerRuntime,
  roomId: string,
): Promise<void> => {
  let session = sessions.get(roomId);
  if (session === undefined) return;

  for (const seat of tributeGivers(session.plan)) {
    if (session.tributeCards.some(({ player }) => player === seat)) continue;
    const managed = runtime.rooms.get(roomId);
    if (managed.game.phase !== "playing") return;
    const participant = managed.room.participants.find(
      (candidate) => candidate.seat === seat,
    );
    if (participant?.kind !== "robot") continue;
    const level = managed.game.levelRank ?? "2";
    const card = [...(managed.game.hands[seat] ?? [])]
      .filter(({ card: candidate }) => !isWildLevelCard(candidate, level))
      .sort(
        (left, right) =>
          singleStrength(right.card, level) - singleStrength(left.card, level),
      )[0];
    if (card === undefined) throw new Error("robot has no legal tribute card");
    await applyLegacyTributeSelection(
      runtime,
      roomId,
      seat,
      card.id,
      "tribute_card",
    );
    session = sessions.get(roomId);
    if (session === undefined) return;
  }

  if (!allTributesReceived(session)) return;
  for (const seat of tributeReceivers(session.plan)) {
    if (session.returnCards.some(({ player }) => player === seat)) continue;
    const managed = runtime.rooms.get(roomId);
    if (managed.game.phase !== "playing") return;
    const participant = managed.room.participants.find(
      (candidate) => candidate.seat === seat,
    );
    if (participant?.kind !== "robot") continue;
    const level = managed.game.levelRank ?? "2";
    const card = (managed.game.hands[seat] ?? []).find(({ card: candidate }) =>
      legalReturnCard(candidate, level),
    );
    if (card === undefined) throw new Error("robot has no legal return card");
    await applyLegacyTributeSelection(
      runtime,
      roomId,
      seat,
      card.id,
      "return_tribute",
    );
    session = sessions.get(roomId);
    if (session === undefined) return;
  }
};

export const legacyTributeResisted = (roomId: string): boolean =>
  resistedRooms.get(roomId) ?? false;

export const legacyTributePhase = (
  roomId: string,
): "tribute" | "return" | null => {
  const session = sessions.get(roomId);
  if (session === undefined) return null;
  return allTributesReceived(session) ? "return" : "tribute";
};

const legacySelections = (selections: readonly TributeSelection[]) =>
  selections.map(({ player, card }) => ({
    player,
    cards: [legacyCard(card.card)],
  }));

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
): boolean => applyLegacyTributeResistance(roomId, managed) !== null;

export const applyLegacyTributeResistance = (
  roomId: string,
  managed: ManagedRoom,
): ManagedRoom | null => {
  const session = sessions.get(roomId);
  const game = managed.game;
  if (session === undefined || game.phase !== "playing") return null;
  const winnerSeat = tributeReceivers(session.plan)[0]!;
  const losingTeamBigJokers = game.hands.reduce(
    (total, hand, seat) =>
      seat % 2 === winnerSeat % 2 ? total : total + countBigJokers(hand),
    0,
  );
  const requiredBigJokers = antiTributeBigJokerRequirement(game.hands.length);
  if (losingTeamBigJokers < requiredBigJokers) return null;
  sessions.delete(roomId);
  resistedRooms.set(roomId, true);
  return {
    ...managed,
    tribute: undefined,
    game: {
      ...game,
      currentTurn: winnerSeat,
      trick: {
        ...game.trick,
        currentTurn: winnerSeat,
        leaderSeat: winnerSeat,
        leadingPlay: null,
        plays: [],
        passedSeats: [],
      },
    },
  };
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

export const highestTributeSelection = (
  selections: readonly TributeSelection[],
  level: Rank,
): TributeSelection => {
  const ordered = [...selections].sort((left, right) => {
    const strengthDifference =
      singleStrength(right.card.card, level) -
      singleStrength(left.card.card, level);
    return strengthDifference !== 0
      ? strengthDifference
      : // Public player displays render in ascending seat order from left to right.
        left.player - right.player;
  });
  const highest = ordered[0];
  if (highest === undefined) {
    throw new Error("at least one tribute selection is required");
  }
  return highest;
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

const withPublicExchangeCard = (
  managed: ManagedRoom,
  seat: number,
  card: DeckCard,
): ManagedRoom => {
  if (managed.game.phase !== "playing") {
    throw new Error("tribute exchange requires the next round to be dealt");
  }
  return {
    ...managed,
    game: {
      ...managed.game,
      trick: {
        ...managed.game.trick,
        leadingPlay: {
          seat,
          cards: [card.card],
          hand: classifyHand([card.card]),
        },
      },
    },
  };
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
    const high = highestTributeSelection(
      [first, second],
      managed.game.levelRank ?? "2",
    );
    const low = high.player === first.player ? second : first;
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
    tribute: undefined,
    game: {
      ...managed.game,
      hands,
      currentTurn: leadSeat,
      trick: {
        ...managed.game.trick,
        currentTurn: leadSeat,
        leaderSeat: leadSeat,
        leadingPlay: null,
        plays: [],
        passedSeats: [],
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
    const visible = withPublicExchangeCard(
      withHands(managed, removeCard(managed.game.hands, seat, cardId)),
      seat,
      card,
    );
    const next = runtime.rooms.set(roomId, visible);
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
  const visibleReturn = withPublicExchangeCard(
    withHands(managed, removeCard(managed.game.hands, seat, cardId)),
    seat,
    selected,
  );
  const visibleNext = runtime.rooms.set(roomId, visibleReturn);
  await runtime.websocket.broadcastGameState(visibleNext);
  await runtime.websocket.sendPrivateHands(visibleNext);

  if (!allReturnsReceived(session)) return;

  await sleep(PUBLIC_EXCHANGE_CARD_MS);
  const finalized = finalizeExchange(runtime.rooms.get(roomId), session);
  sessions.delete(roomId);
  const next = runtime.rooms.set(roomId, finalized);
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
    tribute_phase: legacyTributePhase(roomId),
    tribute_cards: legacySelections(sessions.get(roomId)?.tributeCards ?? []),
    return_tribute_cards: legacySelections(
      sessions.get(roomId)?.returnCards ?? [],
    ),
  }) as unknown as LegacyStateMessage;
