export type RobotPatternKind =
  | "single"
  | "pair"
  | "triple"
  | "full-house"
  | "straight"
  | "consecutive-pairs"
  | "consecutive-triples"
  | "bomb"
  | "straight-flush"
  | "joker-bomb"
  | "invalid";

export interface RobotPatternPriorityInput {
  readonly kind: RobotPatternKind;
  readonly strength: number;
  readonly size: number | undefined;
  readonly playSize?: number | undefined;
  readonly leading: boolean;
  readonly leadCycle: number;
  readonly handSizeBefore?: number | undefined;
  readonly opponentMinHandSize?: number | undefined;
  readonly leadingKind?: RobotPatternKind | undefined;
}

const responseBase: Record<RobotPatternKind, number> = {
  single: 0,
  pair: 100,
  triple: 200,
  "full-house": 300,
  straight: 400,
  "consecutive-pairs": 500,
  "consecutive-triples": 600,
  bomb: 5000,
  "straight-flush": 7000,
  "joker-bomb": 10000,
  invalid: 20000,
};

const leadOrders: readonly (readonly RobotPatternKind[])[] = [
  [
    "consecutive-pairs",
    "full-house",
    "straight",
    "consecutive-triples",
    "triple",
    "pair",
    "single",
  ],
  [
    "pair",
    "full-house",
    "triple",
    "straight",
    "consecutive-pairs",
    "consecutive-triples",
    "single",
  ],
  [
    "triple",
    "consecutive-triples",
    "pair",
    "full-house",
    "straight",
    "consecutive-pairs",
    "single",
  ],
  [
    "straight",
    "full-house",
    "consecutive-pairs",
    "pair",
    "triple",
    "consecutive-triples",
    "single",
  ],
];

const bombPriority = (
  kind: RobotPatternKind,
  size: number | undefined,
  strength: number,
): number | undefined => {
  if (kind === "joker-bomb") return 10000;
  if (kind === "straight-flush") return 7000 + strength;
  if (kind !== "bomb") return undefined;
  if ((size ?? 0) >= 6) return 8000 + (size ?? 0) * 100 + strength;
  if (size === 5) return 6000 + strength;
  return 5000 + strength;
};

export const robotPatternPriority = ({
  kind,
  strength,
  size,
  playSize,
  leading,
  leadCycle,
  handSizeBefore,
  opponentMinHandSize,
  leadingKind,
}: RobotPatternPriorityInput): number => {
  // 残局能一次走完时优先走完，不为了保炸弹而错失胜局。
  if (
    handSizeBefore !== undefined &&
    playSize !== undefined &&
    handSizeBefore === playSize
  ) {
    return -30_000 - playSize * 100 - strength;
  }

  const bomb = bombPriority(kind, size, strength);
  if (bomb !== undefined) {
    // “炸第一顺、封顺封到顶”：仅在对手顺子已形成明显残局威胁时，
    // 才提前动用普通炸弹；同类炸弹优先用更有把握的一手。
    if (
      !leading &&
      leadingKind === "straight" &&
      opponentMinHandSize !== undefined &&
      opponentMinHandSize <= 7 &&
      kind === "bomb"
    ) {
      return 250 - (size ?? 4) * 10 - strength;
    }
    return bomb;
  }
  if (kind === "invalid") return responseBase.invalid;
  if (!leading) {
    // 对手只剩一两张时，不再总用最小牌应对，要提高封堵强度。
    const endgameBlock =
      opponentMinHandSize !== undefined && opponentMinHandSize <= 2
        ? -strength * 10
        : 0;
    return responseBase[kind] + strength + endgameBlock;
  }
  const order = leadOrders[Math.abs(leadCycle) % leadOrders.length]!;
  const index = order.indexOf(kind);
  const fiveCardEndgame =
    playSize === 5 &&
    handSizeBefore !== undefined &&
    handSizeBefore >= 7 &&
    handSizeBefore <= 9
      ? -500
      : 0;
  return (index === -1 ? 900 : index * 100) + strength + fiveCardEndgame;
};
