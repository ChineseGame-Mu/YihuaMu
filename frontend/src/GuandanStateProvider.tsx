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
  observers: string[];
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
  level: GuandanRank | null;
  teamLevels: unknown;
  finishOrder: number[];
  lastGameWinner: number | null;
  lastGameWinnerTeam: GuandanTeam | null;
  lastPromotionSteps: number | null;
  pendingTribute: unknown;
  tributeResisted: boolean;
  matchWinner: GuandanTeam | null;
  minimumPlayers: number | null;
  maximumPlayers: number | null;
  error: string | null;
}

const initialState: GuandanTableState = {
  room: null,
  seat: null,
  players: [],
  observers: [],
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
  level: null,
  teamLevels: null,
  finishOrder: [],
  lastGameWinner: null,
  lastGameWinnerTeam: null,
  lastPromotionSteps: null,
  pendingTribute: null,
  tributeResisted: false,
  matchWinner: null,
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
      return { ...state, room: message.room, seat: message.seat, error: null };
    case "waiting":
      return {
        ...state,
        players: message.players,
        observers: message.observers,
        minimumPlayers: message.minimum_players,
        maximumPlayers: message.maximum_players,
        error: null,
      };
    case "started":
      return {
        ...state,
        playerCount: message.player_count,
        cardsPerPlayer: message.cards_per_player,
        turn: state.turn ?? 0,
        error: null,
      };
    case "hand":
      return { ...state, hand: message.cards, error: null };
    case "state":
      return {
        ...state,
        players: message.players,
        observers: message.observers,
        turn: message.turn,
        handCounts: message.hand_counts,
        lastPlay: message.last_play,
        lastPlayer: message.last_player,
        tablePlays: message.table_plays,
        passes: message.passes,
        trickComplete: message.trick_complete,
        level: message.level,
        teamLevels: message.team_levels,
        finishOrder: message.finish_order,
        lastGameWinner: message.last_game_winner,
        lastGameWinnerTeam: message.last_game_winner_team,
        lastPromotionSteps: message.last_promotion_steps,
        pendingTribute: message.pending_tribute,
        tributeResisted: message.tribute_resisted,
        matchWinner: message.match_winner,
        error: null,
      };
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
