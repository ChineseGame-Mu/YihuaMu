import { RANKS, type Card, type Rank } from "./cards.js";
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
  | {
      readonly type: "join";
      readonly room: string;
      readonly name: string;
      readonly player_id?: string;
      readonly resume_token?: string;
    }
  | {
      readonly type: "reorder_players";
      readonly order: readonly [number, number];
    }
  | {
      readonly type: "move_seat";
      readonly direction: "left" | "right";
    }
  | {
      readonly type: "set_participation";
      readonly active: boolean;
      readonly preferred_partner?: string;
    }
  | { readonly type: "set_bots"; readonly count: 1 | 2 | 3 }
  | { readonly type: "start"; readonly player_count: number }
  | { readonly type: "start_trick" }
  | {
      readonly type: "shuffle_next_round";
      readonly from_position: number | null;
      readonly to_position: number | null;
    }
  | { readonly type: "deal_next_round" }
  | { readonly type: "restart_match" }
  | { readonly type: "play"; readonly card_indexes: readonly number[] }
  | { readonly type: "tribute_card"; readonly card_index: number }
  | { readonly type: "return_tribute"; readonly card_index: number }
  | { readonly type: "pass" }
  | { readonly type: "end_round" };

export type LegacyServerMessage =
  | { readonly type: "connected"; readonly protocol: string }
  | {
      readonly type: "joined";
      readonly room: string;
      readonly seat: number | null;
      readonly player_id?: string;
      readonly resume_token?: string;
    }
  | {
      readonly type: "waiting";
      readonly players: readonly string[];
      readonly observers: readonly string[];
      readonly online_players: readonly boolean[];
      readonly minimum_players: number;
      readonly maximum_players: number;
      readonly card_count_alert_threshold: number;
      readonly next_round_joiners: readonly string[];
      readonly next_round_leavers: readonly string[];
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
      readonly passed_players: readonly number[];
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
      readonly last_game_winner_team: "TeamA" | "TeamB" | null;
      readonly last_promotion_steps: number | null;
      readonly series_match_number: number | null;
      readonly series_total_matches: 3 | null;
      readonly series_completed_matches: number | null;
      readonly series_team_a_wins: number | null;
      readonly series_team_b_wins: number | null;
      readonly pending_tribute: null;
      readonly tribute_resisted: false;
      readonly tribute_phase: "tribute" | "return" | null;
      readonly tribute_cards: readonly {
        readonly player: number;
        readonly cards: readonly LegacyGuandanCard[];
      }[];
      readonly return_tribute_cards: readonly {
        readonly player: number;
        readonly cards: readonly LegacyGuandanCard[];
      }[];
      readonly table_clear_id: number;
      readonly match_winner: "TeamA" | "TeamB" | null;
      readonly next_round_phase: "awaiting_shuffle" | "awaiting_deal" | null;
      readonly card_count_alert_threshold: number;
      readonly next_round_joiners: readonly string[];
      readonly next_round_leavers: readonly string[];
    }
  | { readonly type: "error"; readonly message: string };

const LEGACY_CARD_COUNT_ALERT_THRESHOLD = 6;

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

const displayedLevelRank = (
  game: Extract<ServerMessage, { readonly type: "game_state" }>,
): Rank => {
  const current = game.levelRank ?? "2";
  if (game.phase !== "round-complete" || game.lastPromotionSteps == null) {
    return current;
  }

  const currentIndex = RANKS.indexOf(current);
  const nextIndex = Math.min(
    currentIndex + game.lastPromotionSteps,
    RANKS.indexOf("A"),
  );
  return RANKS[nextIndex]!;
};

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

export const toCleanroomCommand = (
  message: LegacyClientMessage,
  state: FrontendCompatState,
): ClientMessage => {
  switch (message.type) {
    case "join":
      throw new Error(
        "legacy join requires room allocation before command translation",
      );
    case "reorder_players":
      throw new Error(
        "clean-room backend does not support seat reordering yet",
      );
    case "move_seat":
      throw new Error("legacy seat movement is handled by the gateway");
    case "set_participation":
      return { type: "set_next_round_ready", ready: message.active };
    case "set_bots":
      return { type: "set_robots", count: message.count };
    case "start":
      return { type: "start_game" };
    case "start_trick":
      throw new Error("legacy start_trick is handled by the gateway");
    case "shuffle_next_round":
      return { type: "set_next_round_ready", ready: true };
    case "deal_next_round":
      return { type: "next_round" };
    case "restart_match":
      return { type: "next_round" };
    case "play": {
      const cardIds = message.card_indexes.map((index) => {
        const cardId = state.privateCardIds[index];
        if (cardId === undefined)
          throw new Error("legacy play card index is out of range");
        return cardId;
      });
      return { type: "play_cards", cardIds };
    }
    case "tribute_card":
    case "return_tribute":
      throw new Error(
        "clean-room backend does not support tribute exchange yet",
      );
    case "pass":
      return { type: "pass_turn" };
    case "end_round":
      return { type: "next_round" };
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
    observers: (message.observers ?? []).map(({ name }) => name),
    online_players: participants.map(({ connected }) => connected),
    minimum_players: 4,
    maximum_players: 14,
    card_count_alert_threshold: LEGACY_CARD_COUNT_ALERT_THRESHOLD,
    next_round_joiners: (message.observers ?? [])
      .filter(({ readyForNextRound }) => readyForNextRound)
      .map(({ name }) => name),
    next_round_leavers: participants
      .filter(({ leavingAfterRound }) => leavingAfterRound)
      .map(({ name }) => name),
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
  const lastGameWinner =
    game.phase === "round-complete" ? (game.finishedSeats[0] ?? null) : null;
  const lastGameWinnerTeam =
    lastGameWinner === null
      ? null
      : lastGameWinner % 2 === 0
        ? "TeamA"
        : "TeamB";
  const winnerLevel =
    lastGameWinnerTeam === "TeamA"
      ? (game.teamLevels?.A ?? game.levelRank)
      : lastGameWinnerTeam === "TeamB"
        ? (game.teamLevels?.B ?? game.levelRank)
        : null;
  const matchWinner =
    game.phase === "round-complete" && winnerLevel === "A"
      ? lastGameWinnerTeam
      : null;
  const pendingSeriesWin =
    matchWinner !== null && game.seriesMatchNumber != null;
  const seriesTeamAWins =
    game.seriesTeamAWins === null || game.seriesTeamAWins === undefined
      ? null
      : game.seriesTeamAWins +
        (pendingSeriesWin && matchWinner === "TeamA" ? 1 : 0);
  const seriesTeamBWins =
    game.seriesTeamBWins === null || game.seriesTeamBWins === undefined
      ? null
      : game.seriesTeamBWins +
        (pendingSeriesWin && matchWinner === "TeamB" ? 1 : 0);
  const isOpeningRound = (game.roundNumber ?? 1) === 1;
  const losingTeamShuffleReady =
    lastGameWinner !== null &&
    participants.some(
      ({ seat, kind, readyForNextRound, leavingAfterRound }) =>
        seat % 2 !== lastGameWinner % 2 &&
        (kind === "robot" ||
          readyForNextRound === true ||
          leavingAfterRound === true),
    );

  return {
    type: "state",
    players: participants.map(({ name }) => name),
    observers: (room.observers ?? []).map(({ name }) => name),
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
    passed_players: game.passedSeats,
    trick_complete: false,
    last_trick_winner: null,
    initial_draw: isOpeningRound ? game.openingDraw.map(legacyCard) : [],
    initial_draw_winner: isOpeningRound ? game.openingDrawWinner : null,
    // Once a round is complete, show the level that was just earned rather
    // than the level used by the completed deal.  The authoritative next-round
    // transition applies the same promotion exactly once when cards are dealt.
    level: rankMap[displayedLevelRank(game)],
    team_levels: null,
    finish_order: game.finishedSeats,
    last_game_winner: lastGameWinner,
    last_game_winner_team: lastGameWinnerTeam,
    last_promotion_steps: game.lastPromotionSteps ?? null,
    series_match_number: game.seriesMatchNumber ?? null,
    series_total_matches: game.seriesMatchNumber == null ? null : 3,
    series_completed_matches:
      game.seriesCompletedMatches == null
        ? null
        : game.seriesCompletedMatches + (pendingSeriesWin ? 1 : 0),
    series_team_a_wins: seriesTeamAWins,
    series_team_b_wins: seriesTeamBWins,
    pending_tribute: null,
    tribute_resisted: false,
    tribute_phase: null,
    tribute_cards: [],
    return_tribute_cards: [],
    table_clear_id: 0,
    match_winner: matchWinner,
    next_round_phase:
      matchWinner !== null
        ? null
        : game.phase === "round-complete"
          ? losingTeamShuffleReady
            ? "awaiting_deal"
            : "awaiting_shuffle"
          : null,
    card_count_alert_threshold: LEGACY_CARD_COUNT_ALERT_THRESHOLD,
    next_round_joiners: (room.observers ?? [])
      .filter(({ readyForNextRound }) => readyForNextRound)
      .map(({ name }) => name),
    next_round_leavers: participants
      .filter(({ leavingAfterRound }) => leavingAfterRound)
      .map(({ name }) => name),
  };
};
