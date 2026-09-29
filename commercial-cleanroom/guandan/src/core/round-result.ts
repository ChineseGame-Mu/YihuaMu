import { teamForSeat, type SupportedPlayerCount, type Team } from "./table.js";

export interface RoundPlacement {
  readonly place: number;
  readonly seat: number;
  readonly team: Team;
}

export interface RoundOutcome {
  readonly winningTeam: Team;
  readonly losingTeam: Team;
  readonly firstPlaceSeat: number;
  readonly lastPlaceSeat: number;
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

export const buildRoundOutcome = (
  placements: readonly RoundPlacement[],
): RoundOutcome => {
  const first = placements[0];
  const last = placements[placements.length - 1];
  if (first === undefined || last === undefined) {
    throw new Error("round outcome requires at least one placement");
  }

  return {
    winningTeam: first.team,
    losingTeam: first.team === "A" ? "B" : "A",
    firstPlaceSeat: first.seat,
    lastPlaceSeat: last.seat,
  };
};
