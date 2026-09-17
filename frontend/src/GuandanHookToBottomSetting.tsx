import * as React from "react";
import { createPortal } from "react-dom";
import { GuandanStateContext } from "./GuandanStateProvider";
import { GuandanWebsocketContext } from "./GuandanWebsocketProvider";
import type { GuandanTributePlan } from "./guandanProtocol";
import { shouldHideReturnTributeFace } from "./guandanReturnTributePrivacy";

const RETURN_PRIVACY_KEY = "guandan_hide_return_tribute_public";
const RETURN_PRIVACY_BODY_CLASS = "guandan-hide-return-tribute-face";
const RETURN_PRIVACY_STYLE_ID = "guandan-return-tribute-privacy-style";

const GuandanHookToBottomSetting = (): React.JSX.Element | null => {
  const { state } = React.useContext(GuandanStateContext);
  const { send } = React.useContext(GuandanWebsocketContext);
  const [target, setTarget] = React.useState<Element | null>(null);
  const [hideReturnTributePublic, setHideReturnTributePublic] = React.useState(
    () => window.localStorage.getItem(RETURN_PRIVACY_KEY) === "on",
  );

  React.useEffect(() => {
    const refresh = (): void => {
      setTarget(document.querySelector(".guandan-settings"));
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem(
      RETURN_PRIVACY_KEY,
      hideReturnTributePublic ? "on" : "off",
    );
  }, [hideReturnTributePublic]);

  const plan = state.pendingTribute as GuandanTributePlan | null;
  const publicPlayer = state.tablePlays.at(-1)?.player ?? state.lastPlayer;
  const hideCurrentReturn = shouldHideReturnTributeFace(
    hideReturnTributePublic,
    plan,
    state.seat,
    publicPlayer,
  );

  React.useEffect(() => {
    let style = document.getElementById(
      RETURN_PRIVACY_STYLE_ID,
    ) as HTMLStyleElement | null;
    if (style === null) {
      style = document.createElement("style");
      style.id = RETURN_PRIVACY_STYLE_ID;
      style.textContent = `
        body.${RETURN_PRIVACY_BODY_CLASS} .guandan-table-play > span {
          display: none !important;
        }
        body.${RETURN_PRIVACY_BODY_CLASS} .guandan-table-play::after {
          content: "掼蛋";
          display: inline-flex;
          width: 58px;
          height: 82px;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          border: 3px solid #f2f2f2;
          border-radius: 7px;
          background: repeating-linear-gradient(45deg, #244a86 0 6px, #17345f 6px 12px);
          color: white;
          font-weight: 800;
          letter-spacing: 2px;
          box-shadow: 0 2px 5px rgba(0,0,0,.28);
        }
      `;
      document.head.appendChild(style);
    }
    document.body.classList.toggle(RETURN_PRIVACY_BODY_CLASS, hideCurrentReturn);
    return () => document.body.classList.remove(RETURN_PRIVACY_BODY_CLASS);
  }, [hideCurrentReturn]);

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
      <label>
        <input
          type="checkbox"
          checked={hideReturnTributePublic}
          onChange={(event) => setHideReturnTributePublic(event.target.checked)}
        />{" "}
        还贡牌隐私：公共牌桌只显示牌背
      </label>
      <p>
        开启后，还贡动作仍会显示在公共牌桌，但赢家及旁观者只看到牌背；输方可看到还贡牌正面。进贡牌仍正常公开显示。
      </p>
    </div>,
    target,
  );
};

export default GuandanHookToBottomSetting;
