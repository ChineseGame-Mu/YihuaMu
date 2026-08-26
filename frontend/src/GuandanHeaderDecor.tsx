import * as React from "react";

import type { JSX } from "react";

const GuandanHeaderDecor = (): JSX.Element => {
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
    <div className="guandan-header-decor" aria-hidden="true">
      <div className="guandan-header-brand">
        <div className="guandan-header-cards guandan-header-cards--left">
          <span className="guandan-header-card guandan-header-card--black">
            <b>J</b>
            <i>♣</i>
          </span>
          <span className="guandan-header-card guandan-header-card--red">
            <b>10</b>
            <i>♦</i>
          </span>
        </div>

        <strong className="guandan-header-title">掼蛋</strong>

        <div className="guandan-header-cards guandan-header-cards--right">
          <span className="guandan-header-card guandan-header-card--red">
            <b>Q</b>
            <i>♥</i>
          </span>
          <span className="guandan-header-card guandan-header-card--black">
            <b>K</b>
            <i>♠</i>
          </span>
        </div>
      </div>

      <div className="guandan-header-clock" role="timer" aria-label={time}>
        <span className="guandan-stopwatch" aria-hidden="true">
          <span className="guandan-stopwatch-crown" />
          <span className="guandan-stopwatch-hand" />
        </span>
        <time dateTime={now.toISOString()}>{time}</time>
      </div>
    </div>
  );
};

export default GuandanHeaderDecor;
