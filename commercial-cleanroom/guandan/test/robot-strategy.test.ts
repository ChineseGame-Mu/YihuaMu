import { describe, expect, it } from "vitest";
import {
  robotPatternPriority,
  type RobotPatternKind,
} from "../src/core/robot-strategy.js";

const normalKinds: readonly RobotPatternKind[] = [
  "pair",
  "triple",
  "full-house",
  "straight",
  "consecutive-pairs",
  "consecutive-triples",
];

const priority = (
  kind: RobotPatternKind,
  leadCycle: number,
  leading = true,
  size?: number,
): number =>
  robotPatternPriority({ kind, strength: 3, size, leading, leadCycle });

describe("robot varied-play strategy", () => {
  it("uses multi-card leads instead of defaulting to singles", () => {
    for (let cycle = 0; cycle < 12; cycle += 1) {
      const single = priority("single", cycle);
      for (const kind of normalKinds) {
        expect(priority(kind, cycle)).toBeLessThan(single);
      }
    }
  });

  it("rotates lead preference across human-like pattern families", () => {
    const winners = new Set<RobotPatternKind>();
    for (let cycle = 0; cycle < 8; cycle += 1) {
      winners.add(
        [...normalKinds].sort(
          (a, b) => priority(a, cycle) - priority(b, cycle),
        )[0]!,
      );
    }
    expect(winners.size).toBeGreaterThanOrEqual(4);
    expect(winners.has("pair")).toBe(true);
    expect(winners.has("triple")).toBe(true);
    expect(winners.has("straight")).toBe(true);
  });

  it("preserves bombs rather than wasting them on routine leads", () => {
    for (let cycle = 0; cycle < 4; cycle += 1) {
      const single = priority("single", cycle);
      expect(priority("bomb", cycle, true, 4)).toBeGreaterThan(single);
      expect(priority("straight-flush", cycle)).toBeGreaterThan(single);
      expect(priority("joker-bomb", cycle)).toBeGreaterThan(single);
    }
  });

  it("keeps conservative response ordering", () => {
    expect(priority("single", 0, false)).toBeLessThan(
      priority("pair", 0, false),
    );
    expect(priority("pair", 0, false)).toBeLessThan(
      priority("triple", 0, false),
    );
    expect(priority("triple", 0, false)).toBeLessThan(
      priority("bomb", 0, false, 4),
    );
  });
});
