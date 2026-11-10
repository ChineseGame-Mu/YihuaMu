import { describe, expect, it } from "vitest";
import {
  chooseBoundedEndgameMove,
  type PublicEndgamePosition,
  type PublicEndgameRules,
} from "../src/core/robot-endgame-search.js";

type State = { readonly remaining: number; readonly reward: number };
const position = (remaining: number, reward = 0): PublicEndgamePosition<State> => ({
  state: { remaining, reward },
  handSize: remaining,
  opponentMinHandSize: 2,
  leadCycle: 0,
  leading: true,
});
const rules: PublicEndgameRules<State> = {
  legalMoves: (p) =>
    p.state.remaining === 0
      ? []
      : [
          {
            id: "single",
            kind: "single",
            strength: 2,
            size: 1,
            playSize: 1,
            next: { remaining: p.state.remaining - 1, reward: p.state.reward },
          },
          ...(p.state.remaining >= 2
            ? [{
                id: "pair",
                kind: "pair" as const,
                strength: 3,
                size: 2,
                playSize: 2,
                next: { remaining: p.state.remaining - 2, reward: p.state.reward + 10 },
              }]
            : []),
        ],
  advance: (p, move) => ({ ...p, state: move.next, handSize: move.next.remaining }),
  terminalScore: (p) => p.state.remaining === 0 ? 100 + p.state.reward : undefined,
  evaluate: (p) => p.state.reward - p.state.remaining,
};

describe("Master3 bounded legal-only endgame search", () => {
  it("chooses a winning pair in a two-card endgame", () => {
    const result = chooseBoundedEndgameMove(position(2), rules, 100, 3);
    expect(result.move?.id).toBe("pair");
    expect(result.exhausted).toBe(false);
  });

  it("never exceeds node budget and returns a legal fallback", () => {
    const result = chooseBoundedEndgameMove(position(6), rules, 1, 5);
    expect(result.nodes).toBeLessThanOrEqual(1);
    expect(result.exhausted).toBe(true);
    expect(["single", "pair"]).toContain(result.move?.id);
  });

  it("never plays from a terminal state even if stale legal moves are supplied", () => {
    const terminalPosition = position(2);
    const terminalRules: PublicEndgameRules<State> = {
      ...rules,
      terminalScore: () => 100,
    };
    const result = chooseBoundedEndgameMove(terminalPosition, terminalRules, 10, 3);
    expect(result).toEqual({ move: undefined, nodes: 0, exhausted: false });
  });

  it("returns no action when there are no legal moves", () => {
    expect(chooseBoundedEndgameMove(position(0), rules, 5, 3).move).toBeUndefined();
  });

  it("rejects invalid depth and node budgets", () => {
    expect(() => chooseBoundedEndgameMove(position(2), rules, 0, 2)).toThrow("maxNodes");
    expect(() => chooseBoundedEndgameMove(position(2), rules, 10, 13)).toThrow("depth");
  });

  it("is deterministic across identical public positions", () => {
    const first = chooseBoundedEndgameMove(position(5), rules, 100, 4);
    const second = chooseBoundedEndgameMove(position(5), rules, 100, 4);
    expect(first).toEqual(second);
  });
});
