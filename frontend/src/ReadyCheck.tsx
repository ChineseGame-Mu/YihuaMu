import * as React from "react";
import { WebsocketContext } from "./WebsocketProvider";

import type { JSX } from "react";

const ReadyCheck = (): JSX.Element => {
  const { send } = React.useContext(WebsocketContext);

  return (
    <button
      className="big"
      onClick={() => confirm("大家准备好开始游戏了吗？") && send("ReadyCheck")}
    >
      检查大家是否准备好
    </button>
  );
};

export default ReadyCheck;
