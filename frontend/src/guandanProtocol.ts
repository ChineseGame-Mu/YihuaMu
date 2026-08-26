export type GuandanRank =
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

export type GuandanSuit = "Clubs" | "Diamonds" | "Hearts" | "Spades";
export type GuandanJoker = "Small" | "Big";

export type GuandanCard =
  | { Suited: { suit: GuandanSuit; rank: GuandanRank } }
  | { Joker: GuandanJoker };

export type GuandanClientMessage =
  | { type: "join"; room: string; name: string }
  | { type: "reorder_players"; order: [number, number] }
  | { type: "set_participation"; active: boolean }
  | { type: "set_card_count_alert_threshold"; threshold: number }
  | { type: "set_bots"; count: 1 | 2 | 3 }
  | { type: "start"; player_count: number }
  | {
      type: "shuffle_next_round";
      from_position: number | null;
      to_position: number | null;
    }
  | { type: "deal_next_round" }
  | { type: "play"; card_indexes: number[] }
  | { type: "tribute_card"; card_index: number }
  | { type: "return_tribute"; card_index: number }
  | { type: "pass" }
  | { type: "end_round" };

export type GuandanTeam = "TeamA" | "TeamB";

export type GuandanTributePlan =
  | { Single: { giver: number; receiver: number } }
  | { Double: { givers: [number, number]; receivers: [number, number] } };

export type GuandanServerMessage =
  | { type: "connected"; protocol: string }
  | { type: "joined"; room: string; seat: number | null }
  | {
      type: "waiting";
      players: string[];
      observers: string[];
      online_players: boolean[];
      minimum_players: number;
      maximum_players: number;
      card_count_alert_threshold: number;
    }
  | { type: "started"; player_count: number; cards_per_player: number }
  | { type: "hand"; cards: GuandanCard[] }
  | {
      type: "state";
      players: string[];
      observers: string[];
      online_players: boolean[];
      turn: number;
      hand_counts: number[];
      last_play: GuandanCard[];
      last_player: number | null;
      table_plays: Array<{ player: number; cards: GuandanCard[] }>;
      passes: number;
      trick_complete: boolean;
      last_trick_winner: number | null;
      initial_draw: GuandanCard[];
      initial_draw_winner: number | null;
      level: GuandanRank;
      team_levels: unknown;
      finish_order: number[];
      last_game_winner: number | null;
      last_game_winner_team: GuandanTeam | null;
      last_promotion_steps: number | null;
      pending_tribute: GuandanTributePlan | null;
      tribute_resisted: boolean;
      match_winner: GuandanTeam | null;
      next_round_phase: "awaiting_shuffle" | "awaiting_deal" | null;
      card_count_alert_threshold: number;
    }
  | { type: "error"; message: string };

export const encodeGuandanMessage = (message: GuandanClientMessage): string =>
  JSON.stringify(message);

export const decodeGuandanMessage = (payload: string): GuandanServerMessage =>
  JSON.parse(payload) as GuandanServerMessage;
