import type { Rank } from "./cards.js";
import type { DeckCard } from "./deck.js";
import type { PlayingState } from "./game-state.js";
import type { ClassifiedHand, HandKind } from "./hand.js";
import {
  canClassifiedBeatWithLevelRules,
  resolveWildcardInterpretation,
  type LevelRules,
} from "./level-rules.js";
import { teamForSeat } from "./table.js";

export interface ResolvedPlay {
  readonly seat: number;
  readonly cards: readonly DeckCard[];
  readonly hand: ClassifiedHand;
}

export type PublicAction =
  | { readonly type: "play"; readonly play: ResolvedPlay }
  | { readonly type: "pass"; readonly seat: number };

export interface TurnState {
  readonly game: PlayingState;
  readonly levelRank: Rank;
  readonly hands: readonly (readonly DeckCard[])[];
  readonly currentTurn: number;
  readonly currentPlay: ResolvedPlay | null;
  readonly consecutivePasses: number;
  readonly finishedSeats: readonly number[];
  readonly publicActions: readonly PublicAction[];
}

export const createTurnState = (
  game: PlayingState,
  levelRank: Rank = "2",
): TurnState => ({
  game,
  levelRank,
  hands: game.hands,
  currentTurn: game.currentTurn,
  currentPlay: null,
  consecutivePasses: 0,
  finishedSeats: [],
  publicActions: [],
});

const findSeatAfter = (
  state: TurnState,
  fromSeat: number,
  predicate: (seat: number) => boolean,
): number | null => {
  const count = state.game.config.playerCount;
  for (let step = 1; step <= count; step += 1) {
    const seat = (fromSeat + step) % count;
    if (predicate(seat)) return seat;
  }
  return null;
};

const activeSeat = (finishedSeats: ReadonlySet<number>, seat: number): boolean =>
  !finishedSeats.has(seat);

const responseSeats = (
  state: TurnState,
  leaderSeat: number,
  finishedSeats: ReadonlySet<number>,
): readonly number[] => {
  const leaderFinished = finishedSeats.has(leaderSeat);
  const leaderTeam = teamForSeat(leaderSeat);
  return Array.from({ length: state.game.config.playerCount }, (_, seat) => seat).filter(
    (seat) =>
      seat !== leaderSeat &&
      activeSeat(finishedSeats, seat) &&
      (!leaderFinished || teamForSeat(seat) !== leaderTeam),
  );
};

const partnerLeadSeat = (
  state: TurnState,
  leaderSeat: number,
  finishedSeats: ReadonlySet<number>,
): number => {
  const team = teamForSeat(leaderSeat);
  return (
    findSeatAfter(
      state,
      leaderSeat,
      (seat) => activeSeat(finishedSeats, seat) && teamForSeat(seat) === team,
    ) ??
    findSeatAfter(state, leaderSeat, (seat) => activeSeat(finishedSeats, seat)) ??
    leaderSeat
  );
};

const selectedCardsFromHand = (
  hand: readonly DeckCard[],
  cardIds: readonly string[],
): readonly DeckCard[] => {
  if (cardIds.length === 0) throw new Error("at least one card must be played");
  if (new Set(cardIds).size !== cardIds.length) {
    throw new Error("a card cannot be selected twice");
  }

  const byId = new Map(hand.map((card) => [card.id, card]));
  return cardIds.map((id) => {
    const card = byId.get(id);
    if (!card) throw new Error("selected card is not in the player's hand");
    return card;
  });
};

export const playCards = (
  state: TurnState,
  seat: number,
  cardIds: readonly string[],
  declaredKind?: HandKind,
): TurnState => {
  if (seat !== state.currentTurn) throw new Error("it is not this seat's turn");
  if (state.finishedSeats.includes(seat)) throw new Error("this seat has finished");

  const hand = state.hands[seat];
  if (!hand) throw new Error("seat is outside the table");
  const selected = selectedCardsFromHand(hand, cardIds);
  const rules: LevelRules = { levelRank: state.levelRank };
  const resolved = resolveWildcardInterpretation(
    selected.map(({ card }) => card),
    rules,
    declaredKind,
  );

  if (
    state.currentPlay !== null &&
    !canClassifiedBeatWithLevelRules(resolved.hand, state.currentPlay.hand, rules)
  ) {
    throw new Error("played hand does not beat the current hand");
  }

  const selectedIds = new Set(cardIds);
  const hands = state.hands.map((cards, index) =>
    index === seat ? cards.filter(({ id }) => !selectedIds.has(id)) : cards,
  );
  const remaining = hands[seat] ?? [];
  const finishedSeats = new Set(state.finishedSeats);
  if (remaining.length === 0) finishedSeats.add(seat);

  const play: ResolvedPlay = { seat, cards: selected, hand: resolved.hand };
  const responders = responseSeats(state, seat, finishedSeats);
  const publicActions = [...state.publicActions, { type: "play", play } as const];

  if (responders.length === 0) {
    return {
      ...state,
      hands,
      currentTurn: partnerLeadSeat(state, seat, finishedSeats),
      currentPlay: null,
      consecutivePasses: 0,
      finishedSeats: [...finishedSeats],
      publicActions,
    };
  }

  const responderSet = new Set(responders);
  return {
    ...state,
    hands,
    currentTurn: findSeatAfter(state, seat, (candidate) => responderSet.has(candidate))!,
    currentPlay: play,
    consecutivePasses: 0,
    finishedSeats: [...finishedSeats],
    publicActions,
  };
};

export const passTurn = (state: TurnState, seat: number): TurnState => {
  if (seat !== state.currentTurn) throw new Error("it is not this seat's turn");
  if (state.currentPlay === null) throw new Error("the leading seat cannot pass");

  const finishedSeats = new Set(state.finishedSeats);
  const responders = responseSeats(state, state.currentPlay.seat, finishedSeats);
  if (!responders.includes(seat)) throw new Error("this seat is not a responder");

  const passes = state.consecutivePasses + 1;
  const action: PublicAction = { type: "pass", seat };
  const publicActions = [...state.publicActions, action];

  if (passes >= responders.length) {
    const leader = state.currentPlay.seat;
    const currentTurn = finishedSeats.has(leader)
      ? partnerLeadSeat(state, leader, finishedSeats)
      : leader;
    return {
      ...state,
      currentTurn,
      currentPlay: null,
      consecutivePasses: 0,
      publicActions,
    };
  }

  const responderSet = new Set(responders);
  return {
    ...state,
    currentTurn: findSeatAfter(state, seat, (candidate) => responderSet.has(candidate))!,
    consecutivePasses: passes,
    publicActions,
  };
};
