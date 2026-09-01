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

const inferPromotionSteps = (finishOrder: number[]): number | null => {
  const winner = finishOrder[0];
  if (winner === undefined) return null;
  if (finishOrder.length !== 4) return finishOrder.length >= 4 ? 1 : null;
  const partner = (winner + 2) % 4;
  const partnerIndex = finishOrder.indexOf(partner);
  if (partnerIndex < 0) return null;
  const partnerPlace = partnerIndex + 1;
  if (partnerPlace === 2) return 3;
  if (partnerPlace === 3) return 2;
  if (partnerPlace === 4) return 1;
  return null;
};

const rankSequence: GuandanRank[] = [
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Jack",
  "Queen",
  "King",
  "Ace",
];

const advanceRank = (level: GuandanRank, steps: number): GuandanRank => {
  const index = rankSequence.indexOf(level);
  if (index < 0) return level;
  return rankSequence[Math.min(rankSequence.length - 1, index + steps)] ?? level;
};

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
        level: state.level ?? "Two",
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
      const roundComplete =
        message.players.length >= 4 &&
        message.finish_order.length === message.players.length;
      const inferredWinner = roundComplete ? (message.finish_order[0] ?? null) : null;
      const winner = message.last_game_winner ?? inferredWinner ?? state.lastGameWinner;
      const inferredTeam: GuandanTeam | null =
        winner === null ? null : winner % 2 === 0 ? "TeamA" : "TeamB";
      const promotionSteps =
        message.last_promotion_steps ??
        (roundComplete ? inferPromotionSteps(message.finish_order) : null) ??
        state.lastPromotionSteps;
      const serverLevel = message.level ?? state.level ?? "Two";
      const shouldInferNextLevel =
        roundComplete &&
        message.last_promotion_steps === null &&
        promotionSteps !== null &&
        state.level !== null &&
        serverLevel === state.level;
      const effectiveLevel = shouldInferNextLevel
        ? advanceRank(serverLevel, promotionSteps)
        : serverLevel;

      return {
        ...state,
        players: message.players,
        observers: message.observers,
        onlinePlayers: message.online_players,
        hand: state.hand,
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
        level: effectiveLevel,
        teamLevels: message.team_levels,
        finishOrder: message.finish_order,
        lastGameWinner: winner,
        lastGameWinnerTeam: message.last_game_winner_team ?? inferredTeam ?? state.lastGameWinnerTeam,
        lastPromotionSteps: promotionSteps,
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
