import { describe, expect, it } from "vitest";
import {
  chooseBoundedEndgameMove,
  type PublicEndgameMove,
  type PublicEndgamePosition,
  type PublicEndgameRules,
} from "./robot-endgame-search.js";

type State = "root" | "first" | "best" | "unvisited";
const position: PublicEndgamePosition<State> = {
  state: "root",
  handSize: 8,
  opponentMinHandSize: 5,
  leadCycle: 0,
  leading: false,
};
const moves: readonly PublicEndgameMove<State>[] = [
  { id: "first", kind: "single", strength: 1, size: 1, playSize: 1, next: "first" },
  { id: "best", kind: "single", strength: 2, size: 1, playSize: 1, next: "best" },
  { id: "unvisited", kind: "single", strength: 3, size: 1, playSize: 1, next: "unvisited" },
];
const rules: PublicEndgameRules<State> = {
  legalMoves: (p) => (p.state === "root" ? moves : []),
  advance: (p, move) => ({ ...p, state: move.next, handSize: p.handSize - move.playSize }),
  terminalScore: () => undefined,
  evaluate: (p) => ({ root: 0, first: -10, best: 20, unvisited: 100 })[p.state],
};

describe("bounded public-information endgame search", () => {
  it("retains the best evaluated legal move when the node budget expires", () => {
    const result = chooseBoundedEndgameMove(position, rules, 2, 1);
    expect(result).toMatchObject({ nodes: 2, exhausted: true });
    expect(result.move?.id).toBe("best");
    expect(moves).toContain(result.move);
  });

  it("returns no move for a terminal position without expanding nodes", () => {
    const result = chooseBoundedEndgameMove(position, {
      ...rules,
      terminalScore: () => 100,
    }, 2, 1);
    expect(result).toEqual({ move: undefined, nodes: 0, exhausted: false });
  });

  it("falls back to the first ordered legal move with only one search node", () => {
    const result = chooseBoundedEndgameMove(position, rules, 1, 1);
    expect(result).toMatchObject({ nodes: 1, exhausted: true });
    expect(result.move?.id).toBe("first");
    expect(moves).toContain(result.move);
  });

  it("does not invent a move when the legal move list is empty", () => {
    const result = chooseBoundedEndgameMove(position, {
      ...rules,
      legalMoves: () => [],
    }, 2, 1);
    expect(result).toEqual({ move: undefined, nodes: 0, exhausted: false });
  });

  it("rejects invalid search depths before proposing a move", () => {
    expect(() => chooseBoundedEndgameMove(position, rules, 2, 0)).toThrow();
    expect(() => chooseBoundedEndgameMove(position, rules, 2, 13)).toThrow();
  });

  it("rejects invalid node budgets before proposing a move", () => {
    expect(() => chooseBoundedEndgameMove(position, rules, 0, 1)).toThrow();
  });
});
