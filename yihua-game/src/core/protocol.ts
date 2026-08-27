import type { Card } from "./cards.js";

export type ClientMessage =
  | {
      readonly type: "join_room";
      readonly roomId: string;
      readonly playerId: string;
      readonly name: string;
      readonly seat: number;
    }
  | { readonly type: "leave_room"; readonly playerId: string }
  | { readonly type: "set_robots"; readonly count: number }
  | { readonly type: "start_game" }
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
      }[];
    }
  | {
      readonly type: "game_state";
      readonly roomId: string;
      readonly revision: number;
      readonly phase: "playing" | "round-complete";
      readonly currentTurn: number;
      readonly handCounts: readonly number[];
      readonly openingDraw: readonly Card[];
      readonly openingDrawWinner: number;
      readonly leadingPlay: {
        readonly seat: number;
        readonly cards: readonly Card[];
      } | null;
      readonly passedSeats: readonly number[];
      readonly finishedSeats: readonly number[];
      readonly completedTricks: number;
    }
  | {
      readonly type: "private_hand";
      readonly roomId: string;
      readonly revision: number;
      readonly seat: number;
      readonly cards: readonly {
        readonly id: string;
        readonly card: Card;
      }[];
    }
  | { readonly type: "error"; readonly code: string; readonly message: string }
  | { readonly type: "pong"; readonly nonce: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const parseClientMessage = (raw: string): ClientMessage => {
  const parsed: unknown = JSON.parse(raw);
  if (!isObject(parsed) || typeof parsed.type !== "string") {
    throw new Error("message must be an object with a type");
  }

  switch (parsed.type) {
    case "join_room":
      if (
        typeof parsed.roomId !== "string" ||
        typeof parsed.playerId !== "string" ||
        typeof parsed.name !== "string" ||
        typeof parsed.seat !== "number"
      ) {
        throw new Error("invalid join_room message");
      }
      return {
        type: "join_room",
        roomId: parsed.roomId,
        playerId: parsed.playerId,
        name: parsed.name,
        seat: parsed.seat,
      };
    case "leave_room":
      if (typeof parsed.playerId !== "string") {
        throw new Error("invalid leave_room message");
      }
      return { type: "leave_room", playerId: parsed.playerId };
    case "set_robots":
      if (typeof parsed.count !== "number") {
        throw new Error("invalid set_robots message");
      }
      return { type: "set_robots", count: parsed.count };
    case "start_game":
      return { type: "start_game" };
    case "ping":
      if (typeof parsed.nonce !== "string") {
        throw new Error("invalid ping message");
      }
      return { type: "ping", nonce: parsed.nonce };
    default:
      throw new Error(`unsupported message type: ${parsed.type}`);
  }
};

export const encodeServerMessage = (message: ServerMessage): string =>
  JSON.stringify(message);
