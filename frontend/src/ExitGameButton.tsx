import * as React from "react";
import "./exit-game-button.css";

import type { JSX } from "react";

interface IProps {
  onClick: () => void;
}

const ExitGameButton = ({ onClick }: IProps): JSX.Element => (
  <button
    type="button"
    className="normal exit-game-button"
    onClick={onClick}
    aria-label="退出并重新选择游戏"
    title="退出并重新选择游戏"
  >
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <linearGradient id="exit-button-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff8bb" />
          <stop offset="0.45" stopColor="#ffd85e" />
          <stop offset="1" stopColor="#e69a18" />
        </linearGradient>
      </defs>
      <g stroke="#fff4b0" strokeLinejoin="round">
        <path
          d="M17 15h43v66H17z"
          fill="url(#exit-button-gold)"
          strokeWidth="5"
        />
        <path d="M60 25h18v46H60" fill="none" strokeWidth="5" />
        <circle cx="29" cy="49" r="3.7" fill="#31534a" stroke="none" />
        <path
          d="M77 35H57v-9L36 48l21 22v-9h20z"
          fill="url(#exit-button-gold)"
          strokeWidth="4"
        />
      </g>
    </svg>
    <span>退出</span>
  </button>
);

export default ExitGameButton;
