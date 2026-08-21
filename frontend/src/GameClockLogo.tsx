import * as React from "react";
import "./game-clock-logo.css";

import type { JSX } from "react";

export type GameClockKind = "Guandan" | "Tractor" | "FindingFriends";

interface IProps {
  game: GameClockKind;
}

const labels: Record<GameClockKind, string> = {
  Guandan: "掼蛋",
  Tractor: "升级",
  FindingFriends: "找朋友",
};

const classes: Record<GameClockKind, string> = {
  Guandan: "guandan",
  Tractor: "tractor",
  FindingFriends: "finding-friends",
};

const GameClockLogo = ({ game }: IProps): JSX.Element => {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <div
      className={`game-clock-logo game-clock-logo--${classes[game]}`}
      role="timer"
      aria-label={`${labels[game]}，当前时间${time}`}
      title={`${labels[game]} · ${time}`}
    >
      <time dateTime={now.toISOString()}>{time}</time>
    </div>
  );
};

export default GameClockLogo;
