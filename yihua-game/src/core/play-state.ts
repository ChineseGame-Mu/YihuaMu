import type { Rank } from "./cards.js";
import type { DeckCard } from "./deck.js";
import type { PlayingState } from "./game-state.js";
import type { ClassifiedHand, HandKind } from "./hand.js";
import {
  canClassifiedBeatWithLevelRules,
  resolveWildcardInterpretation,
  type LevelRules,
} from "./level-rules.js";

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
  publicActions: [],
});

const nextSeat = (state: TurnState, seat: number): number =>
  (seat + 1) % state.game.config.playerCount;

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
    !canClassifiedBeatWithLevelRules(
      resolved.hand,
      state.currentPlay.hand,
      rules,
    )
  ) {
    throw new Error("played hand does not beat the current hand");
  }

  const selectedIds = new Set(cardIds);
  const hands = state.hands.map((cards, index) =>
    index === seat ? cards.filter(({ id }) => !selectedIds.has(id)) : cards,
  );
  const play: ResolvedPlay = {
    seat,
    cards: selected,
    hand: resolved.hand,
  };

  return {
    ...state,
    hands,
    currentTurn: nextSeat(state, seat),
    currentPlay: play,
    consecutivePasses: 0,
    publicActions: [...state.publicActions, { type: "play", play }],
  };
};

export const passTurn = (state: TurnState, seat: number): TurnState => {
  if (seat !== state.currentTurn) throw new Error("it is not this seat's turn");
  if (state.currentPlay === null)
    throw new Error("the leading seat cannot pass");

  const passes = state.consecutivePasses + 1;
  const action: PublicAction = { type: "pass", seat };

  if (passes >= state.game.config.playerCount - 1) {
    return {
      ...state,
      currentTurn: state.currentPlay.seat,
      currentPlay: null,
      consecutivePasses: 0,
      publicActions: [...state.publicActions, action],
    };
  }

  return {
    ...state,
    currentTurn: nextSeat(state, seat),
    consecutivePasses: passes,
    publicActions: [...state.publicActions, action],
  };
};
