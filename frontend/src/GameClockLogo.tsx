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

const symbols: Record<GameClockKind, string> = {
  Guandan: "掼蛋",
  Tractor: "升级",
  FindingFriends: "找朋友",
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
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="game-clock-logo-ring" cx="50" cy="50" r="46" />
        <path className="game-clock-logo-card" d="M30 18h40v46H30z" />
        <text className="game-clock-logo-suit" x="50" y="49">
          {game === "FindingFriends" ? "友" : game === "Tractor" ? "♠" : "♥"}
        </text>
        <text className="game-clock-logo-name" x="50" y="69">
          {symbols[game]}
        </text>
      </svg>
      <time dateTime={now.toISOString()}>{time}</time>
    </div>
  );
};

export default GameClockLogo;
