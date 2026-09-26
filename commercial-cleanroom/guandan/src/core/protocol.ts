import type { Card, Rank } from "./cards.js";
import type { TeamLevels } from "./competition.js";

export interface CommandMetadata {
  readonly expectedRevision?: number;
  readonly commandId?: string;
}

export type ClientMessage =
  | ({
      readonly type: "join_room";
      readonly roomId: string;
      readonly playerId: string;
      readonly name: string;
      readonly seat: number;
    } & CommandMetadata)
  | ({
      readonly type: "leave_room";
      readonly playerId: string;
    } & CommandMetadata)
  | ({ readonly type: "set_robots"; readonly count: number } & CommandMetadata)
  | ({
      readonly type: "set_next_round_ready";
      readonly ready: boolean;
    } & CommandMetadata)
  | ({ readonly type: "start_game" } & CommandMetadata)
  | ({ readonly type: "next_round" } & CommandMetadata)
  | ({
      readonly type: "tribute_card";
      readonly cardId: string;
    } & CommandMetadata)
  | ({
      readonly type: "return_tribute";
      readonly cardId: string;
    } & CommandMetadata)
  | ({
      readonly type: "play_cards";
      readonly cardIds: readonly string[];
    } & CommandMetadata)
  | ({ readonly type: "pass_turn" } & CommandMetadata)
  | { readonly type: "ping"; readonly nonce: string };

export type ServerMessage =
  | {
      readonly type: "room_state";
      readonly roomId: string;
      readonly revision?: number;
      readonly playerCount: number;
      readonly robotCount: number;
      readonly participants: readonly {
        readonly id: string;
        readonly name: string;
        readonly seat: number;
        readonly kind: "human" | "robot";
        readonly connected: boolean;
        readonly readyForNextRound?: boolean;
        readonly leavingAfterRound?: boolean;
      }[];
      readonly observers?: readonly {
        readonly id: string;
        readonly name: string;
        readonly connected: boolean;
        readonly readyForNextRound: boolean;
        readonly preferredPartnerId?: string;
      }[];
    }
  | {
      readonly type: "game_state";
      readonly roomId: string;
      readonly revision: number;
      readonly phase: "playing" | "round-complete";
      readonly roundNumber?: number;
      readonly levelRank?: Rank | undefined;
      readonly teamLevels?: TeamLevels | undefined;
      readonly lastPromotionSteps?: number | null | undefined;
      readonly seriesMatchNumber?: number | null | undefined;
      readonly seriesCompletedMatches?: number | null | undefined;
      readonly seriesTeamAWins?: number | null | undefined;
      readonly seriesTeamBWins?: number | null | undefined;
      readonly competitionPhase?: "playing" | "tribute" | "return" | undefined;
      readonly currentTurn: number;
      readonly handCounts: readonly number[];
      readonly openingDraw: readonly Card[];
      readonly openingDrawWinner: number | null;
      readonly leadingPlay: {
        readonly seat: number;
        readonly cards: readonly Card[];
      } | null;
      readonly passedSeats: readonly number[];
      readonly finishedSeats: readonly number[];
      readonly completedTricks: number;
      readonly tributeKind?:
        | "none"
        | "single"
        | "double"
        | "anti-tribute"
        | undefined;
      readonly pendingTributeSeats?: readonly number[] | undefined;
      readonly pendingReturnSeats?: readonly number[] | undefined;
      readonly antiTribute?: boolean | undefined;
    }
  | {
      readonly type: "private_hand";
      readonly roomId: string;
      readonly revision: number;
      readonly seat: number;
      readonly cards: readonly { readonly id: string; readonly card: Card }[];
    }
  | { readonly type: "error"; readonly code: string; readonly message: string }
  | { readonly type: "pong"; readonly nonce: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const MAX_ROOM_ID_LENGTH = 64;
const MAX_PLAYER_ID_LENGTH = 128;
const MAX_PLAYER_NAME_LENGTH = 40;
const MAX_COMMAND_ID_LENGTH = 128;
const MAX_CARD_ID_LENGTH = 128;
const MAX_PLAY_CARD_IDS = 64;
const MAX_NONCE_LENGTH = 256;

const boundedString = (
  value: unknown,
  label: string,
  maximumLength: number,
): string => {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maximumLength) {
    throw new Error(`${label} has an invalid length`);
  }
  return trimmed;
};

const commandMetadata = (parsed: Record<string, unknown>): CommandMetadata => {
  const metadata: { expectedRevision?: number; commandId?: string } = {};
  if (parsed.expectedRevision !== undefined) {
    if (
      typeof parsed.expectedRevision !== "number" ||
      !Number.isInteger(parsed.expectedRevision) ||
      parsed.expectedRevision < 0
    )
      throw new Error("expectedRevision must be a non-negative integer");
    metadata.expectedRevision = parsed.expectedRevision;
  }
  if (parsed.commandId !== undefined) {
    metadata.commandId = boundedString(
      parsed.commandId,
      "commandId",
      MAX_COMMAND_ID_LENGTH,
    );
  }
  return metadata;
};

const cardIdMessage = (
  parsed: Record<string, unknown>,
  type: "tribute_card" | "return_tribute",
  metadata: CommandMetadata,
): ClientMessage => {
  if (typeof parsed.cardId !== "string" || parsed.cardId.trim().length === 0) {
    throw new Error(`${type} requires a non-empty cardId`);
  }
  return {
    type,
    cardId: boundedString(parsed.cardId, "cardId", MAX_CARD_ID_LENGTH),
    ...metadata,
  };
};

export const parseClientMessage = (raw: string): ClientMessage => {
  const parsed: unknown = JSON.parse(raw);
  if (!isObject(parsed) || typeof parsed.type !== "string") {
    throw new Error("message must be an object with a type");
  }
  const metadata = commandMetadata(parsed);
  switch (parsed.type) {
    case "join_room":
      if (
        typeof parsed.seat !== "number" ||
        !Number.isInteger(parsed.seat) ||
        parsed.seat < 0 ||
        parsed.seat > 14
      )
        throw new Error("invalid join_room message");
      return {
        type: "join_room",
        roomId: boundedString(parsed.roomId, "roomId", MAX_ROOM_ID_LENGTH),
        playerId: boundedString(
          parsed.playerId,
          "playerId",
          MAX_PLAYER_ID_LENGTH,
        ),
        name: boundedString(parsed.name, "name", MAX_PLAYER_NAME_LENGTH),
        seat: parsed.seat,
        ...metadata,
      };
    case "leave_room":
      return {
        type: "leave_room",
        playerId: boundedString(
          parsed.playerId,
          "playerId",
          MAX_PLAYER_ID_LENGTH,
        ),
        ...metadata,
      };
    case "set_robots":
      if (
        typeof parsed.count !== "number" ||
        !Number.isInteger(parsed.count) ||
        parsed.count < 0 ||
        parsed.count > 3
      )
        throw new Error("invalid set_robots message");
      return { type: "set_robots", count: parsed.count, ...metadata };
    case "set_next_round_ready":
      if (typeof parsed.ready !== "boolean")
        throw new Error("set_next_round_ready requires a boolean ready value");
      return { type: "set_next_round_ready", ready: parsed.ready, ...metadata };
    case "start_game":
      return { type: "start_game", ...metadata };
    case "next_round":
      return { type: "next_round", ...metadata };
    case "tribute_card":
      return cardIdMessage(parsed, "tribute_card", metadata);
    case "return_tribute":
      return cardIdMessage(parsed, "return_tribute", metadata);
    case "play_cards":
      if (
        !Array.isArray(parsed.cardIds) ||
        parsed.cardIds.length === 0 ||
        parsed.cardIds.length > MAX_PLAY_CARD_IDS ||
        parsed.cardIds.some(
          (cardId) =>
            typeof cardId !== "string" ||
            cardId.length === 0 ||
            cardId.length > MAX_CARD_ID_LENGTH,
        )
      )
        throw new Error("play_cards requires non-empty cardIds");
      return {
        type: "play_cards",
        cardIds: parsed.cardIds as string[],
        ...metadata,
      };
    case "pass_turn":
      return { type: "pass_turn", ...metadata };
    case "ping":
      if (
        typeof parsed.nonce !== "string" ||
        parsed.nonce.length > MAX_NONCE_LENGTH
      )
        throw new Error("invalid ping message");
      return { type: "ping", nonce: parsed.nonce };
    default:
      throw new Error(`unsupported message type: ${parsed.type}`);
  }
};

export const encodeServerMessage = (message: ServerMessage): string =>
  JSON.stringify(message);
