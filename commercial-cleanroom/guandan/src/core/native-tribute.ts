import { RANKS, type Card, type Rank } from "./cards.js";
import {
  mandatoryTributeCard,
  tributePlanForPlacements,
  type TributePlan,
} from "./competition.js";
import type { DeckCard } from "./deck.js";
import type { PlayingState } from "./game-state.js";
import type { RoundPlacement } from "./round-result.js";

export type NativeTributeStatus = "tribute" | "return" | "complete";

export interface NativeTributeSelection {
  readonly seat: number;
  readonly card: DeckCard;
}

export interface NativeTributeState {
  readonly kind: TributePlan["kind"];
  readonly transfers: TributePlan["transfers"];
  readonly status: NativeTributeStatus;
  readonly pendingTributeSeats: readonly number[];
  readonly pendingReturnSeats: readonly number[];
  readonly tributeCards: readonly NativeTributeSelection[];
  readonly returnCards: readonly NativeTributeSelection[];
  readonly leadSeat: number;
}

export interface NativeTributeMutation {
  readonly game: PlayingState;
  readonly tribute: NativeTributeState;
}

const isHeartLevel = (card: Card, levelRank: Rank): boolean =>
  card.kind === "suited" && card.suit === "hearts" && card.rank === levelRank;

const cardStrength = (card: Card, levelRank: Rank): number => {
  if (card.kind === "joker") return card.size === "big" ? 1000 : 900;
  if (card.rank === levelRank) return 800;
  return RANKS.indexOf(card.rank);
};

const replaceHand = (
  game: PlayingState,
  seat: number,
  hand: readonly DeckCard[],
): PlayingState => ({
  ...game,
  hands: game.hands.map((current, index) => (index === seat ? hand : current)),
});

const removeCard = (
  game: PlayingState,
  seat: number,
  cardId: string,
): { game: PlayingState; card: DeckCard } => {
  const hand = game.hands[seat];
  if (hand === undefined) throw new Error("seat is outside the table");
  const card = hand.find(({ id }) => id === cardId);
  if (card === undefined) throw new Error("selected card is not in seat's hand");
  return {
    game: replaceHand(
      game,
      seat,
      hand.filter(({ id }) => id !== cardId),
    ),
    card,
  };
};

const addCard = (
  game: PlayingState,
  seat: number,
  card: DeckCard,
): PlayingState => {
  const hand = game.hands[seat];
  if (hand === undefined) throw new Error("seat is outside the table");
  return replaceHand(game, seat, [...hand, card]);
};

const receivers = (tribute: NativeTributeState): readonly number[] =>
  tribute.transfers.map(({ toSeat }) => toSeat);

const allSelected = (
  selections: readonly NativeTributeSelection[],
  seats: readonly number[],
): boolean =>
  seats.every((seat) => selections.some((selection) => selection.seat === seat));

const selectionFor = (
  selections: readonly NativeTributeSelection[],
  seat: number,
): NativeTributeSelection => {
  const found = selections.find((selection) => selection.seat === seat);
  if (found === undefined) throw new Error("required tribute selection is missing");
  return found;
};

export const prepareNativeTribute = (
  placements: readonly RoundPlacement[],
  game: PlayingState,
): NativeTributeState => {
  const plan = tributePlanForPlacements(placements, game.hands);
  const fallbackLead = placements[0]?.seat ?? game.currentTurn;
  if (plan.kind === "none" || plan.kind === "anti-tribute") {
    return {
      kind: plan.kind,
      transfers: plan.transfers,
      status: "complete",
      pendingTributeSeats: [],
      pendingReturnSeats: [],
      tributeCards: [],
      returnCards: [],
      leadSeat: fallbackLead,
    };
  }
  return {
    kind: plan.kind,
    transfers: plan.transfers,
    status: "tribute",
    pendingTributeSeats: plan.transfers.map(({ fromSeat }) => fromSeat),
    pendingReturnSeats: [],
    tributeCards: [],
    returnCards: [],
    leadSeat: fallbackLead,
  };
};

export const submitNativeTribute = (
  game: PlayingState,
  tribute: NativeTributeState,
  seat: number,
  cardId: string,
): NativeTributeMutation => {
  if (tribute.status !== "tribute")
    throw new Error("tribute cards are not being accepted");
  if (!tribute.pendingTributeSeats.includes(seat))
    throw new Error("this seat is not required to pay tribute");
  if (tribute.tributeCards.some((selection) => selection.seat === seat))
    throw new Error("this seat has already paid tribute");
  const levelRank = game.levelRank ?? "2";
  const required = mandatoryTributeCard(game.hands[seat] ?? [], levelRank);
  if (required.id !== cardId)
    throw new Error("tribute must be the highest eligible card");
  const removed = removeCard(game, seat, cardId);
  const tributeCards = [...tribute.tributeCards, { seat, card: removed.card }];
  const readyForReturn = allSelected(
    tributeCards,
    tribute.pendingTributeSeats,
  );
  return {
    game: removed.game,
    tribute: {
      ...tribute,
      tributeCards,
      status: readyForReturn ? "return" : "tribute",
      pendingReturnSeats: readyForReturn ? receivers(tribute) : [],
    },
  };
};

export const isLegalReturnTributeCard = (
  card: Card,
  levelRank: Rank,
): boolean => {
  if (card.kind !== "suited") return false;
  if (isHeartLevel(card, levelRank) || card.rank === levelRank) return false;
  return RANKS.indexOf(card.rank) <= RANKS.indexOf("10");
};

const finalizeNativeTribute = (
  game: PlayingState,
  tribute: NativeTributeState,
): NativeTributeMutation => {
  let nextGame = game;
  let leadSeat = tribute.leadSeat;

  if (tribute.kind === "single") {
    const transfer = tribute.transfers[0];
    if (transfer === undefined)
      throw new Error("single tribute transfer missing");
    const paid = selectionFor(tribute.tributeCards, transfer.fromSeat).card;
    const returned = selectionFor(tribute.returnCards, transfer.toSeat).card;
    nextGame = addCard(nextGame, transfer.toSeat, paid);
    nextGame = addCard(nextGame, transfer.fromSeat, returned);
    leadSeat = transfer.fromSeat;
  } else if (tribute.kind === "double") {
    if (tribute.transfers.length !== 2)
      throw new Error("double tribute requires two transfers");
    const levelRank = game.levelRank ?? "2";
    const paid = tribute.transfers.map((transfer) => ({
      transfer,
      selection: selectionFor(tribute.tributeCards, transfer.fromSeat),
    }));
    paid.sort(
      (a, b) =>
        cardStrength(b.selection.card.card, levelRank) -
        cardStrength(a.selection.card.card, levelRank),
    );
    const highReceiver = tribute.transfers[0]!.toSeat;
    const lowReceiver = tribute.transfers[1]!.toSeat;
    const high = paid[0]!;
    const low = paid[1]!;
    const highReturn = selectionFor(tribute.returnCards, highReceiver).card;
    const lowReturn = selectionFor(tribute.returnCards, lowReceiver).card;
    nextGame = addCard(nextGame, highReceiver, high.selection.card);
    nextGame = addCard(nextGame, high.transfer.fromSeat, highReturn);
    nextGame = addCard(nextGame, lowReceiver, low.selection.card);
    nextGame = addCard(nextGame, low.transfer.fromSeat, lowReturn);
    leadSeat = high.transfer.fromSeat;
  }

  nextGame = {
    ...nextGame,
    currentTurn: leadSeat,
    trick: {
      ...nextGame.trick,
      leaderSeat: leadSeat,
      currentTurn: leadSeat,
      leadingPlay: null,
      passedSeats: [],
    },
  };

  return {
    game: nextGame,
    tribute: {
      ...tribute,
      status: "complete",
      pendingTributeSeats: [],
      pendingReturnSeats: [],
      leadSeat,
    },
  };
};

export const submitNativeReturnTribute = (
  game: PlayingState,
  tribute: NativeTributeState,
  seat: number,
  cardId: string,
): NativeTributeMutation => {
  if (tribute.status !== "return")
    throw new Error("return cards are not being accepted");
  if (!tribute.pendingReturnSeats.includes(seat))
    throw new Error("this seat is not required to return tribute");
  if (tribute.returnCards.some((selection) => selection.seat === seat))
    throw new Error("this seat has already returned tribute");
  const hand = game.hands[seat];
  if (hand === undefined) throw new Error("seat is outside the table");
  const selected = hand.find(({ id }) => id === cardId);
  if (selected === undefined)
    throw new Error("selected return card is not in seat's hand");
  const levelRank = game.levelRank ?? "2";
  if (!isLegalReturnTributeCard(selected.card, levelRank)) {
    throw new Error(
      "return card must be a non-level suited card ranked 2 through 10",
    );
  }
  const removed = removeCard(game, seat, cardId);
  const returnCards = [...tribute.returnCards, { seat, card: removed.card }];
  const nextTribute = { ...tribute, returnCards };
  if (!allSelected(returnCards, tribute.pendingReturnSeats)) {
    return { game: removed.game, tribute: nextTribute };
  }
  return finalizeNativeTribute(removed.game, nextTribute);
};
