import { describe, expect, it } from "vitest";
import { settleRound } from "../src/core/settlement.js";

describe("round settlement", () => {
  it("promotes three levels for a four-player one-two finish", () => {
    const result = settleRound(4, [0, 2, 1, 3]);
    expect(result.winnerTeam).toBe("A");
    expect(result.promotionSteps).toBe(3);
    expect(result.teamLevels.A).toBe("5");
    expect(result.nextLeadSeat).toBe(0);
  });

  it("promotes two levels when the winner's partner finishes third", () => {
    const result = settleRound(4, [1, 0, 3, 2]);
    expect(result.winnerTeam).toBe("B");
    expect(result.promotionSteps).toBe(2);
    expect(result.teamLevels.B).toBe("4");
  });

  it("promotes one level when the winner's partner finishes fourth", () => {
    const result = settleRound(4, [0, 1, 3, 2]);
    expect(result.promotionSteps).toBe(1);
    expect(result.teamLevels.A).toBe("3");
  });

  it("requires at least a two-step result to win a four-player match at Ace", () => {
    expect(
      settleRound(4, [0, 1, 3, 2], { A: "A", B: "K" }).matchWinner,
    ).toBeNull();
    expect(settleRound(4, [0, 1, 2, 3], { A: "A", B: "K" }).matchWinner).toBe(
      "A",
    );
  });

  it("uses one-step promotion for expanded tables", () => {
    const result = settleRound(10, [5, 0, 1, 2, 3, 4, 6, 7, 8]);
    expect(result.finishOrder).toHaveLength(10);
    expect(result.winnerTeam).toBe("B");
    expect(result.promotionSteps).toBe(1);
    expect(result.teamLevels.B).toBe("3");
    expect(result.nextLeadSeat).toBe(5);
  });

  it("ends an expanded-table match when the winner's team is already at Ace", () => {
    const result = settleRound(14, [12, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], {
      A: "A",
      B: "Q",
    });
    expect(result.matchWinner).toBe("A");
    expect(result.nextLevel).toBe("A");
  });

  it("rejects duplicate finish positions", () => {
    expect(() => settleRound(4, [0, 0, 1, 2])).toThrow(/duplicate/);
  });
});
