import * as React from "react";
import type { JSX } from "react";
import type {
  GuandanCard,
  GuandanRank,
  GuandanServerMessage,
  GuandanTeam,
} from "./guandanProtocol";
import { GuandanWebsocketContext } from "./GuandanWebsocketProvider";

interface GuandanTableState {
  room: string | null;
  seat: number | null;
  players: string[];
  pendingPlayers: string[];
  observers: string[];
  onlinePlayers: boolean[];
  playerCount: number | null;
  cardsPerPlayer: number | null;
  cardCountAlertThreshold: number;
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

const initialState: GuandanTableState = {
  room: null,
  seat: null,
  players: [],
  pendingPlayers: [],
  observers: [],
  onlinePlayers: [],
  playerCount: null,
  cardsPerPlayer: null,
  cardCountAlertThreshold: 6,
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

interface GuandanStateContextValue {
  state: GuandanTableState;
  reset: () => void;
}

export const GuandanStateContext =
  React.createContext<GuandanStateContextValue>({
    state: initialState,
    reset: () => {},
  });

interface GuandanStateProviderProps {
  children: JSX.Element[] | JSX.Element;
}

const reduceMessage = (
  state: GuandanTableState,
  message: GuandanServerMessage,
): GuandanTableState => {
  switch (message.type) {
    case "connected":
      return { ...state, error: null };
    case "joined":
      return state.room === message.room
        ? { ...state, seat: message.seat, error: null }
        : {
            ...initialState,
            room: message.room,
            seat: message.seat,
            error: null,
          };
    case "waiting":
      return {
        ...state,
        players: message.players,
        pendingPlayers: message.pending_players,
        observers: message.observers,
        onlinePlayers: message.online_players,
        minimumPlayers: message.minimum_players,
        maximumPlayers: message.maximum_players,
        cardCountAlertThreshold: message.card_count_alert_threshold,
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
      const ownSeat = state.seat;
      const ownHandFinished =
        ownSeat !== null &&
        (message.hand_counts[ownSeat] === 0 ||
          message.finish_order.includes(ownSeat));
      return {
        ...state,
        players: message.players,
        pendingPlayers: message.pending_players,
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
        cardCountAlertThreshold: message.card_count_alert_threshold,
        error: null,
      };
    }
    case "error":
      return { ...state, error: message.message };
  }
};

const GuandanStateProvider: React.FunctionComponent<
  React.PropsWithChildren<GuandanStateProviderProps>
> = ({ children }) => {
  const { lastMessage, messageSequence } = React.useContext(
    GuandanWebsocketContext,
  );
  const [state, setState] = React.useState<GuandanTableState>(initialState);

  React.useEffect(() => {
    if (lastMessage !== null) {
      setState((current) => reduceMessage(current, lastMessage));
    }
  }, [messageSequence, lastMessage]);

  const reset = React.useCallback(() => setState(initialState), []);
  const value = React.useMemo(() => ({ state, reset }), [state, reset]);

  return (
    <GuandanStateContext.Provider value={value}>
      {children}
    </GuandanStateContext.Provider>
  );
};

export default GuandanStateProvider;
