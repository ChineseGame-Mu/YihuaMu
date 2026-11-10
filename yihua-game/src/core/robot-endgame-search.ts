import { robotPatternPriority, type RobotPatternKind } from "./robot-strategy.js";

/**
 * Bounded, deterministic endgame planner. The authoritative game engine must
 * supply LEGAL actions and the public-only successor states; this module does
 * not inspect deck order, opponent hands, or manufacture card combinations.
 */
export interface PublicEndgameMove<State> {
  readonly id: string;
  readonly kind: RobotPatternKind;
  readonly strength: number;
  readonly size: number;
  readonly playSize: number;
  readonly next: State;
}

export interface PublicEndgamePosition<State> {
  readonly state: State;
  readonly handSize: number;
  readonly opponentMinHandSize: number;
  readonly leadCycle: number;
  readonly leading: boolean;
  readonly leadingKind?: RobotPatternKind;
}

export interface PublicEndgameRules<State> {
  readonly legalMoves: (position: PublicEndgamePosition<State>) => readonly PublicEndgameMove<State>[];
  readonly advance: (
    position: PublicEndgamePosition<State>,
    move: PublicEndgameMove<State>,
  ) => PublicEndgamePosition<State>;
  /** Terminal values are from this robot's team's perspective. */
  readonly terminalScore: (position: PublicEndgamePosition<State>) => number | undefined;
  /** Whether the public current actor belongs to the robot's team. Defaults to true for single-agent planning. */
  readonly maximizingTurn?: (position: PublicEndgamePosition<State>) => boolean;
  /** Nonterminal, public-only heuristic score; higher is better. */
  readonly evaluate: (position: PublicEndgamePosition<State>) => number;
}

export interface EndgameSearchResult<State> {
  readonly move: PublicEndgameMove<State> | undefined;
  readonly nodes: number;
  readonly exhausted: boolean;
}

export const chooseBoundedEndgameMove = <State>(
  position: PublicEndgamePosition<State>,
  rules: PublicEndgameRules<State>,
  maxNodes: number,
  depth: number,
): EndgameSearchResult<State> => {
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1) {
    throw new Error("maxNodes must be a positive safe integer");
  }
  if (!Number.isSafeInteger(depth) || depth < 1 || depth > 12) {
    throw new Error("depth must be an integer from 1 to 12");
  }

  let nodes = 0;
  let exhausted = false;
  const priority = (
    p: PublicEndgamePosition<State>,
    move: PublicEndgameMove<State>,
  ): number =>
    robotPatternPriority({
      kind: move.kind,
      strength: move.strength,
      size: move.size,
      playSize: move.playSize,
      handSizeBefore: p.handSize,
      opponentMinHandSize: p.opponentMinHandSize,
      leading: p.leading,
      leadCycle: p.leadCycle,
      leadingKind: p.leadingKind,
    });

  const ordered = (p: PublicEndgamePosition<State>) =>
    [...rules.legalMoves(p)].sort(
      (a, b) => priority(p, a) - priority(p, b) || a.id.localeCompare(b.id),
    );

  // A fixed node budget bounds CPU cost; if exceeded, use a legal heuristic
  // fallback rather than returning an unverified speculative move.
  const rootMoves = ordered(position);
  if (rootMoves.length === 0) {
    return { move: undefined, nodes: 0, exhausted: false };
  }
  let best = rootMoves[0]!;
  let bestScore = Number.NEGATIVE_INFINITY;

  const score = (p: PublicEndgamePosition<State>, remaining: number, alpha: number, beta: number): number => {
    const terminal = rules.terminalScore(p);
    if (terminal !== undefined) return terminal;
    if (remaining === 0 || nodes >= maxNodes) {
      if (nodes >= maxNodes) exhausted = true;
      return rules.evaluate(p);
    }
    const moves = ordered(p);
    if (moves.length === 0) return rules.evaluate(p);
    const maximizing = rules.maximizingTurn?.(p) ?? true;
    let result = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
    let explored = false;
    for (const move of moves) {
      if (nodes >= maxNodes) {
        exhausted = true;
        break;
      }
      nodes += 1;
      explored = true;
      const child = score(rules.advance(p, move), remaining - 1, alpha, beta);
      result = maximizing ? Math.max(result, child) : Math.min(result, child);
      // Prune public legal branches that cannot improve the root choice.
      if (maximizing) alpha = Math.max(alpha, result);
      else beta = Math.min(beta, result);
      if (alpha >= beta) break;
    }
    return explored ? result : rules.evaluate(p);
  };

  for (const move of rootMoves) {
    if (nodes >= maxNodes) {
      exhausted = true;
      break;
    }
    nodes += 1;
    const value = score(rules.advance(position, move), depth - 1, bestScore, Number.POSITIVE_INFINITY);
    if (value > bestScore) {
      bestScore = value;
      best = move;
    }
  }
  return { move: exhausted ? rootMoves[0] : best, nodes, exhausted };
};
