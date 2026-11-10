import { describe, expect, it } from "vitest";
import {
  chooseBoundedEndgameMove,
  type PublicEndgamePosition,
  type PublicEndgameRules,
} from "../src/core/robot-endgame-search.js";

type Node = "root" | "safe" | "risky" | "safe-win" | "risky-loss" | "risky-win";
const position = (state: Node): PublicEndgamePosition<Node> => ({
  state,
  handSize: 3,
  opponentMinHandSize: 2,
  leadCycle: 0,
  leading: state === "root",
});
const edges: Partial<Record<Node, readonly Node[]>> = {
  root: ["safe", "risky"],
  safe: ["safe-win"],
  risky: ["risky-loss", "risky-win"],
};
const terminal: Partial<Record<Node, number>> = {
  "safe-win": 10,
  "risky-loss": -10,
  "risky-win": 100,
};
describe("Master3 public-only endgame alpha-beta pruning", () => {
  it("prunes the optimistic opponent response after a losing reply", () => {
    const visited: Node[] = [];
    const rules: PublicEndgameRules<Node> = {
      legalMoves: (p) => (edges[p.state] ?? []).map((next) => ({
        id: next,
        kind: "single" as const,
        strength: next === "risky" ? 2 : 1,
        size: 1,
        playSize: 1,
        next,
      })),
      advance: (_p, move) => position(move.next),
      maximizingTurn: (p) => p.state === "root",
      terminalScore: (p) => {
        visited.push(p.state);
        return terminal[p.state];
      },
      evaluate: () => 0,
    };
    const result = chooseBoundedEndgameMove(position("root"), rules, 10, 2);
    expect(result.move?.id).toBe("safe");
    expect(result.exhausted).toBe(false);
    expect(result.nodes).toBe(4);
    expect(visited).not.toContain("risky-win");
  });
});
