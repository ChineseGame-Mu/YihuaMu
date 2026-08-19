import * as React from "react";
import GameMode from "./GameMode";
import GameStatisticsButton from "./GameStatisticsButton";
import SettingsButton from "./SettingsButton";
import { GameModeSettings } from "./gen-types";

import type { JSX } from "react";

interface IProps {
  gameMode: GameModeSettings;
  chatLink?: string | null;
}

const reselectButtonStyle: React.CSSProperties = {
  marginLeft: "14px",
  padding: "6px 14px",
  fontSize: "18px",
  fontWeight: 700,
  verticalAlign: "middle",
  borderRadius: "8px",
  cursor: "pointer",
};

const returnToGameSelection = (): void => {
  window.location.href = `${window.location.origin}${window.location.pathname}`;
};

const Header = (props: IProps): JSX.Element => (
  <div>
    <h1>
      <GameMode gameMode={props.gameMode} />
      <button
        type="button"
        className="normal"
        style={reselectButtonStyle}
        onClick={returnToGameSelection}
      >
        重新选择
      </button>
      &nbsp;
      <SettingsButton />
      <GameStatisticsButton />
    </h1>
    {props.chatLink !== undefined && props.chatLink !== null ? (
      <p>
        聊天室：{" "}
        <a href={props.chatLink} target="_blank" rel="noreferrer">
          {props.chatLink}
        </a>
      </p>
    ) : null}
  </div>
);

export default Header;
