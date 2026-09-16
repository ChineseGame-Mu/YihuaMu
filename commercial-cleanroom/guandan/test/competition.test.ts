import { describe, expect, it } from "vitest";
import {
  applyPromotion,
  initialTeamLevels,
  mandatoryTributeCard,
  promotionForPlacements,
  tributePlanForPlacements,
} from "../src/core/competition.js";
import type { DeckCard } from "../src/core/deck.js";
import { buildRoundPlacements } from "../src/core/round-result.js";

const suited = (
  id: string,
  rank: "2" | "3" | "10" | "A",
  suit: "clubs" | "hearts" = "clubs",
): DeckCard => ({
  id,
  copy: 0,
  card: { kind: "suited", suit, rank },
});

const big = (id: string): DeckCard => ({
  id,
  copy: 0,
  card: { kind: "joker", size: "big" },
});

describe("four-player competitive progression", () => {
  it("promotes 3 for 1-2, 2 for 1-3, and 1 for 1-4", () => {
    const levels = initialTeamLevels();
    expect(
      promotionForPlacements(
        buildRoundPlacements(4, [0, 2, 1, 3]),
        levels,
      ).steps,
    ).toBe(3);
    expect(
      promotionForPlacements(
        buildRoundPlacements(4, [0, 1, 2, 3]),
        levels,
      ).steps,
    ).toBe(2);
    expect(
      promotionForPlacements(
        buildRoundPlacements(4, [0, 1, 3, 2]),
        levels,
      ).steps,
    ).toBe(1);
  });

  it("tracks K to A and formal pass-A", () => {
    const k = { A: "K", B: "2" } as const;
    const toA = promotionForPlacements(
      buildRoundPlacements(4, [0, 1, 3, 2]),
      k,
    );
    expect(toA.after).toBe("A");
    expect(toA.passedA).toBe(false);
    const atA = applyPromotion(k, toA);
    const pass = promotionForPlacements(
      buildRoundPlacements(4, [0, 1, 3, 2]),
      atA,
    );
    expect(pass.passedA).toBe(true);
  });

  it("excludes heart-level wildcard from mandatory tribute", () => {
    const chosen = mandatoryTributeCard(
      [suited("wild", "10", "hearts"), suited("ace", "A")],
      "10",
    );
    expect(chosen.id).toBe("ace");
  });

  it("plans single and double tribute by placements", () => {
    const hands = Array.from({ length: 4 }, (_, seat) => [
      suited(`c${seat}`, "3"),
    ]);
    expect(
      tributePlanForPlacements(
        buildRoundPlacements(4, [0, 1, 2, 3]),
        hands,
      ).kind,
    ).toBe("single");
    expect(
      tributePlanForPlacements(
        buildRoundPlacements(4, [0, 2, 1, 3]),
        hands,
      ).kind,
    ).toBe("double");
  });

  it("recognizes single anti-tribute from two big jokers", () => {
    const hands: DeckCard[][] = [
      [suited("a", "3")],
      [suited("b", "3")],
      [suited("c", "3")],
      [big("d1"), big("d2")],
    ];
    expect(
      tributePlanForPlacements(
        buildRoundPlacements(4, [0, 1, 2, 3]),
        hands,
      ).kind,
    ).toBe("anti-tribute");
  });

  it("recognizes double anti-tribute when the two payers hold two big jokers in total", () => {
    const hands: DeckCard[][] = [
      [suited("a", "3")],
      [big("b1")],
      [suited("c", "3")],
      [big("d1")],
    ];
    expect(
      tributePlanForPlacements(
        buildRoundPlacements(4, [0, 2, 1, 3]),
        hands,
      ).kind,
    ).toBe("anti-tribute");
  });
});
