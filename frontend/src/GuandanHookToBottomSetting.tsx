import * as React from "react";
import { createPortal } from "react-dom";
import { GuandanStateContext } from "./GuandanStateProvider";
import { GuandanWebsocketContext } from "./GuandanWebsocketProvider";

const GuandanHookToBottomSetting = (): React.JSX.Element | null => {
  const { state } = React.useContext(GuandanStateContext);
  const { send } = React.useContext(GuandanWebsocketContext);
  const [target, setTarget] = React.useState<Element | null>(null);

  React.useEffect(() => {
    const refresh = (): void => {
      setTarget(document.querySelector(".guandan-settings"));
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (target === null) return null;

  const gameStarted = state.playerCount !== null;
  const canChange = state.room !== null && state.seat !== null && !gameStarted;

  return createPortal(
    <div className="guandan-hook-to-bottom-setting">
      <label>
        <input
          type="checkbox"
          checked={state.hookToBottom}
          disabled={!canChange}
          onChange={(event) =>
            send({
              type: "set_hook_to_bottom",
              enabled: event.target.checked,
            })
          }
        />{" "}
        一勾到底
      </label>
      <p>
        开启后：四人局中，某队正在打 J 时若被对方双下，该队下一局直接降回 2
        重新开始。此设置属于整个牌室，开局后锁定。
      </p>
    </div>,
    target,
  );
};

export default GuandanHookToBottomSetting;
