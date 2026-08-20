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

const Header = (props: IProps): JSX.Element => {
  const isTractor = props.gameMode === "Tractor";
  const logoSrc = isTractor ? "shengji-logo.svg" : "friends-logo.svg";
  const logoAlt = isTractor ? "升级 / 拖拉机" : "找朋友";

  return (
    <div className="game-header-with-logo">
      <img className="game-table-logo" src={logoSrc} alt={`${logoAlt} Logo`} />
      <h1>
        <GameMode gameMode={props.gameMode} />
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
};

export default Header;
