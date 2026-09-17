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
  readonly leading: boolean;
  readonly leadCycle: number;
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
  leading,
  leadCycle,
}: RobotPatternPriorityInput): number => {
  const bomb = bombPriority(kind, size, strength);
  if (bomb !== undefined) return bomb;
  if (kind === "invalid") return responseBase.invalid;
  if (!leading) return responseBase[kind] + strength;
  const order = leadOrders[Math.abs(leadCycle) % leadOrders.length]!;
  const index = order.indexOf(kind);
  return (index === -1 ? 900 : index * 100) + strength;
};
