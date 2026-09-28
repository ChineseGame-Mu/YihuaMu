import * as React from "react";
import { TimerContext } from "./TimerProvider";

interface Props {
  timeout: number;
  callback: () => void;
}

const Timeout = (props: Props): null => {
  const { setTimeout, clearTimeout } = React.useContext(TimerContext);
  const callback = React.useRef(props.callback);
  callback.current = props.callback;

  React.useEffect(() => {
    const timeout = setTimeout(() => callback.current(), props.timeout);
    return () => clearTimeout(timeout);
  }, [clearTimeout, props.timeout, setTimeout]);

  return null;
};

export default Timeout;
