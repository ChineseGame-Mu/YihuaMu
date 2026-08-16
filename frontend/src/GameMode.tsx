import * as React from "react";
import { GameModeSettings, GameMode } from "./gen-types";

import type { JSX } from "react";

interface IProps {
  gameMode: GameModeSettings | GameMode;
}
const GameModeE = (props: IProps): JSX.Element => {
  const rules = (
    <a href="rules.html" target="_blank">
      游戏规则
    </a>
  );
  if (props.gameMode === "Tractor") {
    return (
      <span>
        升级 / <span className="red">拖拉机</span>（{rules}）
      </span>
    );
  } else {
    return <span>找朋友（{rules}）</span>;
  }
};

export default GameModeE;
