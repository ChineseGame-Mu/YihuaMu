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
        <svg viewBox="0 0 100 72">
          <path
            className="guandan-clock-laurel"
            d="M19 54c-7-6-10-14-9-23M15 49l-6-1M13 43l-6-3M12 36l-5-5M81 54c7-6 10-14 9-23M85 49l6-1M87 43l6-3M88 36l5-5"
          />
          <circle className="guandan-clock-face" cx="50" cy="34" r="27" />
          <path
            className="guandan-clock-bell"
            d="M43 19c0-4 3-7 7-7s7 3 7 7v5c0 3 2 5 4 7H39c2-2 4-4 4-7Z"
          />
          <path className="guandan-clock-bell" d="M47 34h6" />
          <circle className="guandan-clock-pin" cx="50" cy="35" r="1.8" />
        </svg>
        <time dateTime={now.toISOString()}>{time}</time>
        <span className="guandan-header-clock-label">本局计时</span>
      </div>
    </div>
  );
};

export default GuandanHeaderDecor;
