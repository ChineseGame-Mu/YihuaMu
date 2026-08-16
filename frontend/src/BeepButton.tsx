import * as React from "react";
import { WebsocketContext } from "./WebsocketProvider";

import type { JSX } from "react";

const BeepButton = (): JSX.Element => {
  const { send } = React.useContext(WebsocketContext);

  return (
    <button
      className="big"
      title="提醒当前玩家"
      onClick={() =>
        confirm("确定要给当前出牌的玩家发送提醒吗？") && send("Beep")
      }
    >
      🛎️
    </button>
  );
};

export default BeepButton;
