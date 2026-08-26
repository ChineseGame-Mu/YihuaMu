export const SUPPORTED_PLAYER_COUNTS = [4, 6, 8, 10, 12, 14] as const;

export type SupportedPlayerCount = (typeof SUPPORTED_PLAYER_COUNTS)[number];

export const CARDS_PER_PLAYER = 27;
export const MIN_BOT_COUNT = 0;
export const MAX_BOT_COUNT = 3;

export type Team = "A" | "B";

export interface TableConfig {
  readonly playerCount: SupportedPlayerCount;
  readonly botCount: number;
  readonly cardsPerPlayer: typeof CARDS_PER_PLAYER;
}

export const isSupportedPlayerCount = (
  value: number,
): value is SupportedPlayerCount =>
  SUPPORTED_PLAYER_COUNTS.includes(value as SupportedPlayerCount);

export const teamForSeat = (seat: number): Team => {
  if (!Number.isInteger(seat) || seat < 0) {
    throw new Error("seat must be a non-negative integer");
  }
  return seat % 2 === 0 ? "A" : "B";
};

export const createTableConfig = (
  playerCount: number,
  botCount: number,
): TableConfig => {
  if (!isSupportedPlayerCount(playerCount)) {
    throw new Error("player count must be one of 4, 6, 8, 10, 12, 14");
  }
  if (
    !Number.isInteger(botCount) ||
    botCount < MIN_BOT_COUNT ||
    botCount > MAX_BOT_COUNT
  ) {
    throw new Error("bot count must be an integer from 0 through 3");
  }
  if (botCount >= playerCount) {
    throw new Error("at least one human player is required");
  }
  return {
    playerCount,
    botCount,
    cardsPerPlayer: CARDS_PER_PLAYER,
  };
};
