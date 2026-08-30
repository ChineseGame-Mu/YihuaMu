import type {
  GuandanCard,
  GuandanClientMessage,
  GuandanRank,
  GuandanServerMessage,
  GuandanTeam,
} from "./guandanProtocol";

export interface GuandanTableState {
  room: string | null;
  seat: number | null;
  players: string[];
  observers: string[];
  onlinePlayers: boolean[];
  playerCount: number | null;
  cardsPerPlayer: number | null;
  hand: GuandanCard[];
  turn: number | null;
  handCounts: number[];
  lastPlay: GuandanCard[];
  lastPlayer: number | null;
  tablePlays: Array<{ player: number; cards: GuandanCard[] }>;
  passes: number;
  trickComplete: boolean;
  lastTrickWinner: number | null;
  initialDraw: GuandanCard[];
  initialDrawWinner: number | null;
  level: GuandanRank | null;
  teamLevels: unknown;
  finishOrder: number[];
  lastGameWinner: number | null;
  lastGameWinnerTeam: GuandanTeam | null;
  lastPromotionSteps: number | null;
  pendingTribute: unknown;
  tributeResisted: boolean;
  matchWinner: GuandanTeam | null;
  nextRoundPhase: "awaiting_shuffle" | "awaiting_deal" | null;
  minimumPlayers: number | null;
  maximumPlayers: number | null;
  error: string | null;
}

export const initialGuandanTableState: GuandanTableState = {
  room: null,
  seat: null,
  players: [],
  observers: [],
  onlinePlayers: [],
  playerCount: null,
  cardsPerPlayer: null,
  hand: [],
  turn: null,
  handCounts: [],
  lastPlay: [],
  lastPlayer: null,
  tablePlays: [],
  passes: 0,
  trickComplete: false,
  lastTrickWinner: null,
  initialDraw: [],
  initialDrawWinner: null,
  level: null,
  teamLevels: null,
  finishOrder: [],
  lastGameWinner: null,
  lastGameWinnerTeam: null,
  lastPromotionSteps: null,
  pendingTribute: null,
  tributeResisted: false,
  matchWinner: null,
  nextRoundPhase: null,
  minimumPlayers: null,
  maximumPlayers: null,
  error: null,
};

export const shouldClearOwnHand = (
  ownSeat: number | null,
  finishOrder: number[],
): boolean => ownSeat !== null && finishOrder.includes(ownSeat);

export const adaptGuandanServerMessage = (
  state: GuandanTableState,
  message: GuandanServerMessage,
): GuandanTableState => {
  switch (message.type) {
    case "connected":
      return { ...state, error: null };
    case "joined":
      return {
        ...initialGuandanTableState,
        room: message.room,
        seat: message.seat,
        error: null,
      };
    case "waiting":
      return {
        ...state,
        players: message.players,
        observers: message.observers,
        onlinePlayers: message.online_players,
        minimumPlayers: message.minimum_players,
        maximumPlayers: message.maximum_players,
        error: null,
      };
    case "started":
      return {
        ...state,
        playerCount: message.player_count,
        cardsPerPlayer: message.cards_per_player,
        turn: 0,
        lastPlay: [],
        lastPlayer: null,
        tablePlays: [],
        passes: 0,
        trickComplete: false,
        lastTrickWinner: null,
        initialDraw: [],
        initialDrawWinner: null,
        finishOrder: [],
        pendingTribute: null,
        tributeResisted: false,
        nextRoundPhase: null,
        error: null,
      };
    case "hand":
      return { ...state, hand: message.cards, error: null };
    case "state": {
      const ownHandFinished = shouldClearOwnHand(state.seat, message.finish_order);
      return {
        ...state,
        players: message.players,
        observers: message.observers,
        onlinePlayers: message.online_players,
        hand: ownHandFinished ? [] : state.hand,
        turn: message.turn,
        handCounts: message.hand_counts,
        lastPlay: message.last_play,
        lastPlayer: message.last_player,
        tablePlays: message.table_plays,
        passes: message.passes,
        trickComplete: message.trick_complete,
        lastTrickWinner: message.last_trick_winner,
        initialDraw: message.initial_draw,
        initialDrawWinner: message.initial_draw_winner,
        level: message.level,
        teamLevels: message.team_levels,
        finishOrder: message.finish_order,
        lastGameWinner: message.last_game_winner,
        lastGameWinnerTeam: message.last_game_winner_team,
        lastPromotionSteps: message.last_promotion_steps,
        pendingTribute: message.pending_tribute,
        tributeResisted: message.tribute_resisted,
        matchWinner: message.match_winner,
        nextRoundPhase: message.next_round_phase,
        error: null,
      };
    }
    case "error":
      return { ...state, error: message.message };
  }
};

export type GuandanWireClientMessage =
  | GuandanClientMessage
  | {
      type: "join";
      room: string;
      name: string;
      player_count: number;
    };

interface GuandanClientAdapterOptions {
  cleanroom: boolean;
  room: string | null;
  playerCount: number | null;
}

const supportedPlayerCounts = [4, 6, 8, 10, 12, 14];

export const adaptGuandanClientMessage = (
  message: GuandanClientMessage,
  options: GuandanClientAdapterOptions,
): GuandanWireClientMessage => {
  if (!options.cleanroom || message.type !== "join") return message;

  const requested = options.playerCount ?? 4;
  const playerCount = supportedPlayerCounts.includes(requested) ? requested : 4;
  const room = options.room?.trim();

  return {
    ...message,
    room: room || message.room,
    player_count: playerCount,
  };
};
