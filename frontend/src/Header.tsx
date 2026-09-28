import * as React from "react";
import GameMode from "./GameMode";
import GameStatisticsButton from "./GameStatisticsButton";
import SettingsButton from "./SettingsButton";
import PersonalSettingsButton from "./PersonalSettingsButton";
import { GameModeSettings } from "./gen-types";
import ExitGameButton from "./ExitGameButton";
import GameClockLogo from "./GameClockLogo";
import { AppStateContext } from "./AppStateProvider";

import type { JSX } from "react";

interface IProps {
  gameMode: GameModeSettings;
  chatLink?: string | null;
}

const returnToGameSelection = (): void => {
  window.location.href = `${window.location.origin}${window.location.pathname}`;
};

const Header = (props: IProps): JSX.Element => {
  const { state } = React.useContext(AppStateContext);
  return (
    <div>
      <h1 className="game-header-row">
        <ExitGameButton onClick={returnToGameSelection} />
        <GameMode gameMode={props.gameMode} />
        &nbsp;
        <SettingsButton />
        <PersonalSettingsButton playerName={state.name} />
        <GameStatisticsButton />
        <GameClockLogo
          game={props.gameMode === "Tractor" ? "Tractor" : "FindingFriends"}
        />
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
