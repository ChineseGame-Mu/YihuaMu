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
    <img src="exit-game.svg" alt="" aria-hidden="true" />
  </button>
);

export default ExitGameButton;
