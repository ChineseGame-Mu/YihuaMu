import { teamForSeat, type SupportedPlayerCount, type Team } from "./table.js";

export interface RoundPlacement {
  readonly place: number;
  readonly seat: number;
  readonly team: Team;
}

export const buildRoundPlacements = (
  playerCount: SupportedPlayerCount,
  finishOrder: readonly number[],
): RoundPlacement[] => {
  if (finishOrder.length !== playerCount) {
    throw new Error("finish order must contain every seat exactly once");
  }

  const uniqueSeats = new Set(finishOrder);
  if (
    uniqueSeats.size !== playerCount ||
    finishOrder.some(
      (seat) => !Number.isInteger(seat) || seat < 0 || seat >= playerCount,
    )
  ) {
    throw new Error("finish order must contain every seat exactly once");
  }

  return finishOrder.map((seat, index) => ({
    place: index + 1,
    seat,
    team: teamForSeat(seat),
  }));
};
