import type { DeckCard } from "./deck.js";
import type { HandKind } from "./hand.js";
import {
  canClassifiedBeatWithLevelRules,
  resolveWildcardInterpretation,
  type LevelRules,
} from "./level-rules.js";
import { passTurn, playCards, type TurnState } from "./play-state.js";

export const ROBOT_MIN_DELAY_MS = 800;
export const ROBOT_MAX_DELAY_MS = 1800;

export const robotDelayMs = (random: () => number = Math.random): number => {
  const sample = random();
  if (sample < 0 || sample >= 1 || !Number.isFinite(sample)) {
    throw new Error("random source must return a finite value in [0, 1)");
  }
  const range = ROBOT_MAX_DELAY_MS - ROBOT_MIN_DELAY_MS + 1;
  return ROBOT_MIN_DELAY_MS + Math.floor(sample * range);
};

export type RobotTurn =
  | {
      readonly type: "play";
      readonly cardIds: readonly string[];
      readonly declaredKind: HandKind;
    }
  | { readonly type: "pass" };

const combinations = function* (
  cards: readonly DeckCard[],
  size: number,
  start = 0,
  prefix: readonly DeckCard[] = [],
): Generator<readonly DeckCard[]> {
  if (prefix.length === size) {
    yield prefix;
    return;
  }
  for (
    let index = start;
    index <= cards.length - (size - prefix.length);
    index += 1
  ) {
    yield* combinations(cards, size, index + 1, [...prefix, cards[index]!]);
  }
};

const targetKind = (state: TurnState): HandKind =>
  state.currentPlay?.hand.kind ?? "single";

const targetSize = (state: TurnState): number =>
  state.currentPlay?.hand.size ?? 1;

export const chooseRobotTurn = (state: TurnState, seat: number): RobotTurn => {
  if (seat !== state.currentTurn) throw new Error("it is not this seat's turn");
  const hand = state.hands[seat];
  if (!hand) throw new Error("seat is outside the table");
  if (state.finishedSeats.includes(seat) || hand.length === 0)
    return { type: "pass" };

  const size = targetSize(state);
  if (size > hand.length) return { type: "pass" };

  const kind = targetKind(state);
  const rules: LevelRules = { levelRank: state.levelRank };
  for (const cards of combinations(hand, size)) {
    try {
      const resolved = resolveWildcardInterpretation(
        cards.map(({ card }) => card),
        rules,
        kind,
      );
      if (
        state.currentPlay === null ||
        canClassifiedBeatWithLevelRules(
          resolved.hand,
          state.currentPlay.hand,
          rules,
        )
      ) {
        return {
          type: "play",
          cardIds: cards.map(({ id }) => id),
          declaredKind: resolved.hand.kind,
        };
      }
    } catch {
      // This subset does not form the required hand kind.
    }
  }
  return { type: "pass" };
};

export const applyRobotTurn = (state: TurnState, seat: number): TurnState => {
  const turn = chooseRobotTurn(state, seat);
  return turn.type === "play"
    ? playCards(state, seat, turn.cardIds, turn.declaredKind)
    : passTurn(state, seat);
};
