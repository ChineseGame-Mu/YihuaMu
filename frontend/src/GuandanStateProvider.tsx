import * as React from "react";
import type { JSX } from "react";
import { GuandanWebsocketContext } from "./GuandanWebsocketProvider";
import {
  adaptGuandanServerMessage,
  initialGuandanTableState,
} from "./guandanCompatibilityAdapter";
import type { GuandanTableState } from "./guandanCompatibilityAdapter";

interface GuandanStateContextValue {
  state: GuandanTableState;
  reset: () => void;
}

export const GuandanStateContext =
  React.createContext<GuandanStateContextValue>({
    state: initialGuandanTableState,
    reset: () => {},
  });

interface GuandanStateProviderProps {
  children: JSX.Element[] | JSX.Element;
}

const GuandanStateProvider: React.FunctionComponent<
  React.PropsWithChildren<GuandanStateProviderProps>
> = ({ children }) => {
  const { lastMessage, messageSequence } = React.useContext(
    GuandanWebsocketContext,
  );
  const [state, setState] = React.useState<GuandanTableState>(
    initialGuandanTableState,
  );

  React.useEffect(() => {
    if (lastMessage !== null) {
      setState((current) => adaptGuandanServerMessage(current, lastMessage));
    }
  }, [messageSequence, lastMessage]);

  const reset = React.useCallback(() => setState(initialGuandanTableState), []);
  const value = React.useMemo(() => ({ state, reset }), [state, reset]);

  return (
    <GuandanStateContext.Provider value={value}>
      {children}
    </GuandanStateContext.Provider>
  );
};

export default GuandanStateProvider;
