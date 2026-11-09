import { describe, expect, it } from "vitest";
import {
  chooseBoundedEndgameMove,
  type PublicEndgamePosition,
  type PublicEndgameRules,
} from "../src/core/robot-endgame-search.js";

// A public game tree: the opponent may select either legal response.
// The robot must choose the move with the best WORST-CASE outcome.
type Node = "root" | "risky" | "safe" | "loss" | "win" | "draw";
const p = (state: Node): PublicEndgamePosition<Node> => ({
  state, handSize: 3, opponentMinHandSize: 2, leadCycle: 0, leading: state === "root",
});
const rules: PublicEndgameRules<Node> = {
  legalMoves: (position) => {
    const edges: Partial<Record<Node, readonly Node[]>> = {
      root: ["risky", "safe"],
      risky: ["win", "loss"],
      safe: ["draw"],
    };
    return (edges[position.state] ?? []).map((next) => ({
      id: next,
      kind: "single" as const,
      strength: 2,
      size: 1,
      playSize: 1,
      next,
    }));
  },
  advance: (_position, move) => p(move.next),
  maximizingTurn: (position) => position.state === "root",
  terminalScore: (position) => ({ win: 100, loss: -100, draw: 10 } as Partial<Record<Node, number>>)[position.state],
  evaluate: () => 0,
};
describe("Master3 endgame public-turn minimax", () => {
  it("selects guaranteed positive outcome instead of optimistic opponent cooperation", () => {
    const result = chooseBoundedEndgameMove(p("root"), rules, 20, 2);
    expect(result.move?.id).toBe("safe");
    expect(result.exhausted).toBe(false);
    expect(result.nodes).toBeLessThanOrEqual(20);
  });
  it("still returns a legal root action under a tiny budget", () => {
    const result = chooseBoundedEndgameMove(p("root"), rules, 1, 2);
    expect(["risky", "safe"]).toContain(result.move?.id);
    expect(result.exhausted).toBe(true);
  });
});
