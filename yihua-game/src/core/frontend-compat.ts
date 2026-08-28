import type { Card } from "./cards.js";
import type { ClientMessage, ServerMessage } from "./protocol.js";

export type LegacyGuandanCard =
  | {
      readonly Suited: {
        readonly suit: "Clubs" | "Diamonds" | "Hearts" | "Spades";
        readonly rank:
          | "Two"
          | "Three"
          | "Four"
          | "Five"
          | "Six"
          | "Seven"
          | "Eight"
          | "Nine"
          | "Ten"
          | "Jack"
          | "Queen"
          | "King"
          | "Ace";
      };
    }
  | { readonly Joker: "Small" | "Big" };

export type LegacyClientMessage =
  | { readonly type: "join"; readonly room: string; readonly name: string }
  | { readonly type: "set_participation"; readonly active: boolean }
  | { readonly type: "start"; readonly player_count: number }
  | { readonly type: "play"; readonly card_indexes: readonly number[] }
  | { readonly type: "pass" }
  | { readonly type: "end_round" }
  | {
      readonly type: "reorder_players";
      readonly order: readonly [number, number];
    }
  | { readonly type: "set_bots"; readonly count: 1 | 2 | 3 }
  | {
      readonly type: "shuffle_next_round";
      readonly from_position: number;
      readonly to_position: number;
    }
  | { readonly type: "deal_next_round" }
  | { readonly type: "tribute_card"; readonly card_index: number }
  | { readonly type: "return_tribute"; readonly card_index: number };

export type LegacyServerMessage =
  | { readonly type: "connected"; readonly protocol: string }
  | {
      readonly type: "joined";
      readonly room: string;
      readonly seat: number | null;
    }
  | {
      readonly type: "waiting";
      readonly players: readonly string[];
      readonly observers: readonly string[];
      readonly online_players: readonly boolean[];
      readonly minimum_players: number;
      readonly maximum_players: number;
    }
  | {
      readonly type: "started";
      readonly player_count: number;
      readonly cards_per_player: number;
    }
  | { readonly type: "hand"; readonly cards: readonly LegacyGuandanCard[] }
  | {
      readonly type: "state";
      readonly players: readonly string[];
      readonly observers: readonly string[];
      readonly online_players: readonly boolean[];
      readonly turn: number;
      readonly hand_counts: readonly number[];
      readonly last_play: readonly LegacyGuandanCard[];
      readonly last_player: number | null;
      readonly table_plays: readonly {
        readonly player: number;
        readonly cards: readonly LegacyGuandanCard[];
      }[];
      readonly passes: number;
      readonly trick_complete: boolean;
      readonly last_trick_winner: number | null;
      readonly initial_draw: readonly LegacyGuandanCard[];
      readonly initial_draw_winner: number | null;
      readonly level:
        | "Two"
        | "Three"
        | "Four"
        | "Five"
        | "Six"
        | "Seven"
        | "Eight"
        | "Nine"
        | "Ten"
        | "Jack"
        | "Queen"
        | "King"
        | "Ace";
      readonly team_levels: null;
      readonly finish_order: readonly number[];
      readonly last_game_winner: number | null;
      readonly last_game_winner_team: null;
      readonly last_promotion_steps: number | null;
      readonly pending_tribute: null;
      readonly tribute_resisted: false;
      readonly match_winner: null;
      readonly next_round_phase: "awaiting_shuffle" | "awaiting_deal" | null;
    }
  | { readonly type: "error"; readonly message: string };

const rankMap = {
  "2": "Two",
  "3": "Three",
  "4": "Four",
  "5": "Five",
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
  "10": "Ten",
  J: "Jack",
  Q: "Queen",
  K: "King",
  A: "Ace",
} as const;

const suitMap = {
  clubs: "Clubs",
  diamonds: "Diamonds",
  hearts: "Hearts",
  spades: "Spades",
} as const;

export const legacyCard = (card: Card): LegacyGuandanCard =>
  card.kind === "joker"
    ? { Joker: card.size === "small" ? "Small" : "Big" }
    : {
        Suited: {
          suit: suitMap[card.suit],
          rank: rankMap[card.rank],
        },
      };

export interface FrontendCompatState {
  readonly roomId: string;
  readonly playerId: string;
  readonly seat: number | null;
  readonly privateCardIds: readonly string[];
}

const unsupportedLegacyCommand = (type: LegacyClientMessage["type"]): never => {
  throw new Error(
    `legacy command ${type} is not implemented by the clean-room engine`,
  );
};

export const toCleanroomCommand = (
  message: LegacyClientMessage,
  state: FrontendCompatState,
): ClientMessage => {
  switch (message.type) {
    case "join":
      throw new Error(
        "legacy join requires room allocation before command translation",
      );
    case "set_participation":
      return { type: "set_next_round_ready", ready: message.active };
    case "start":
      return { type: "start_game" };
    case "play": {
      const cardIds = message.card_indexes.map((index) => {
        const cardId = state.privateCardIds[index];
        if (cardId === undefined)
          throw new Error("legacy play card index is out of range");
        return cardId;
      });
      return { type: "play_cards", cardIds };
    }
    case "pass":
      return { type: "pass_turn" };
    case "end_round":
      return { type: "next_round" };
    case "reorder_players":
    case "set_bots":
    case "shuffle_next_round":
    case "deal_next_round":
    case "tribute_card":
    case "return_tribute":
      return unsupportedLegacyCommand(message.type);
  }
};

export const roomStateToLegacyWaiting = (
  message: Extract<ServerMessage, { readonly type: "room_state" }>,
): LegacyServerMessage => {
  const participants = [...message.participants].sort(
    (a, b) => a.seat - b.seat,
  );
  return {
    type: "waiting",
    players: participants.map(({ name }) => name),
    observers: [],
    online_players: participants.map(({ connected }) => connected),
    minimum_players: 4,
    maximum_players: 14,
  };
};

export const privateHandToLegacy = (
  message: Extract<ServerMessage, { readonly type: "private_hand" }>,
): LegacyServerMessage => ({
  type: "hand",
  cards: message.cards.map(({ card }) => legacyCard(card)),
});

export const gameStateToLegacy = (
  room: Extract<ServerMessage, { readonly type: "room_state" }>,
  game: Extract<ServerMessage, { readonly type: "game_state" }>,
): LegacyServerMessage => {
  const participants = [...room.participants].sort((a, b) => a.seat - b.seat);
  const lastPlay = game.leadingPlay?.cards.map(legacyCard) ?? [];
  return {
    type: "state",
    players: participants.map(({ name }) => name),
    observers: [],
    online_players: participants.map(({ connected }) => connected),
    turn: game.currentTurn,
    hand_counts: game.handCounts,
    last_play: lastPlay,
    last_player: game.leadingPlay?.seat ?? null,
    table_plays:
      game.leadingPlay === null
        ? []
        : [{ player: game.leadingPlay.seat, cards: lastPlay }],
    passes: game.passedSeats.length,
    trick_complete: false,
    last_trick_winner: null,
    initial_draw: game.openingDraw.map(legacyCard),
    initial_draw_winner: game.openingDrawWinner,
    level: "Two",
    team_levels: null,
    finish_order: game.finishedSeats,
    last_game_winner: null,
    last_game_winner_team: null,
    last_promotion_steps: null,
    pending_tribute: null,
    tribute_resisted: false,
    match_winner: null,
    next_round_phase: game.phase === "round-complete" ? "awaiting_deal" : null,
  };
};
