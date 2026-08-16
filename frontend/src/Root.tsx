import * as React from "react";
import classNames from "classnames";
import Errors from "./Errors";
import Initialize from "./Initialize";
import Draw from "./Draw";
import Exchange from "./Exchange";
import JoinRoom from "./JoinRoom";
import { AppStateContext } from "./AppStateProvider";
import { TimerContext } from "./TimerProvider";
import Credits from "./Credits";
import Chat from "./Chat";
import Play from "./Play";
import DebugInfo from "./DebugInfo";
import TitleHandler from "./TitleHandler";
import ResetButton from "./ResetButton";

import type { JSX } from "react";

const Confetti = React.lazy(async () => await import("./Confetti"));

const Root = (): JSX.Element => {
  const { state, updateState } = React.useContext(AppStateContext);
  const timerContext = React.useContext(TimerContext);
  const hasRoomInUrl = window.location.hash.replace(/^#/, "").length === 16;
  const [showLobby, setShowLobby] = React.useState<boolean>(hasRoomInUrl);

  const [previousHeaderMessages, setPreviousHeaderMessages] = React.useState<
    string[]
  >([]);
  const [showHeaderMessages, setShowHeaderMessages] = React.useState<boolean>(
    state.headerMessages.length > 0,
  );
  React.useEffect(() => {
    if (
      state.headerMessages.length > 0 &&
      (previousHeaderMessages.length !== state.headerMessages.length ||
        !previousHeaderMessages.every((m, i) => state.headerMessages[i] === m))
    ) {
      setShowHeaderMessages(true);
    } else if (state.headerMessages.length === 0) {
      setShowHeaderMessages(false);
    }
    setPreviousHeaderMessages(state.headerMessages);
  }, [state.headerMessages]);

  React.useEffect(() => {
    if (state.settings.darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }

    return () => {
      document.body.classList.remove("dark-mode");
    };
  }, [state.settings.darkMode]);

  const headerMessages = showHeaderMessages ? (
    <div
      className="header-message"
      onClick={() => setShowHeaderMessages(false)}
    >
      {state.headerMessages.map((msg, idx) => (
        <p key={idx}>{msg}</p>
      ))}
    </div>
  ) : null;

  if (state.connected) {
    if (state.gameState === null || state.roomName.length !== 16) {
      if (!showLobby) {
        return (
          <div
            style={{
              maxWidth: 720,
              margin: "0 auto",
              padding: "48px 20px 32px",
              textAlign: "center",
            }}
          >
            {headerMessages}
            <Errors errors={state.errors} />
            <div style={{ fontSize: 52, marginBottom: 12 }}>🃏</div>
            <h1 style={{ fontSize: 38, marginBottom: 8 }}>升级 · 找朋友</h1>
            <p style={{ fontSize: 20, marginTop: 0, opacity: 0.8 }}>
              Yihua 升级游戏中文修改版
            </p>
            <p style={{ fontSize: 17, lineHeight: 1.7, margin: "28px auto" }}>
              在线和亲友一起玩升级、拖拉机、找朋友。支持多副牌玩法，并按本版本规则进行游戏。
            </p>
            <button
              type="button"
              onClick={() => setShowLobby(true)}
              style={{
                fontSize: 22,
                fontWeight: 700,
                padding: "15px 42px",
                borderRadius: 12,
                border: "1px solid #8f0010",
                background: "#bb0313",
                color: "white",
                cursor: "pointer",
                margin: "8px 0 24px",
              }}
            >
              开始游戏
            </button>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 22,
                flexWrap: "wrap",
                fontSize: 17,
              }}
            >
              <a href="rules.html">游戏规则</a>
              <a href="rules.html">新手指南</a>
              <a href="#" onClick={(e) => e.preventDefault()}>
                更新记录
              </a>
            </div>
            <p style={{ marginTop: 48, fontSize: 14, opacity: 0.65 }}>
              Yihua modified · Based on Robert Ying Shengji
            </p>
            <TitleHandler playerName={state.name} />
          </div>
        );
      }

      return (
        <div>
          {headerMessages}
          <Errors errors={state.errors} />
          <div className="game">
            <button
              type="button"
              className="normal"
              onClick={() => setShowLobby(false)}
              style={{ marginTop: 12 }}
            >
              ← 返回首页
            </button>
            <h1>
              升级 / <span className="red">Tractor</span> / 找朋友 /{" "}
              <span className="red">Finding Friends</span>
            </h1>
            <JoinRoom
              name={state.name}
              room_name={state.roomName}
              setName={(name: string) => updateState({ name })}
              setRoomName={(roomName: string) => {
                updateState({ roomName });
                window.location.hash = roomName;
              }}
            />
          </div>
          <hr />
          <Credits />
          <TitleHandler playerName={state.name} />
        </div>
      );
    } else {
      return (
        <div
          className={classNames(
            state.settings.fourColor ? "four-color" : null,
            state.settings.showCardLabels ? "always-show-labels" : null,
            state.settings.hideChatBox ? "hide-chat-box" : null,
          )}
        >
          {headerMessages}
          <Errors errors={state.errors} />
          {state.confetti !== null ? (
            <React.Suspense fallback={null}>
              <Confetti
                confetti={state.confetti}
                clearConfetti={() => updateState({ confetti: null })}
              />
            </React.Suspense>
          ) : null}
          <div className="game">
            {"Initialize" in state.gameState ? null : (
              <ResetButton state={state.gameState} name={state.name} />
            )}
            {"Initialize" in state.gameState ? (
              <Initialize
                state={state.gameState.Initialize}
                name={state.name}
              />
            ) : null}
            {"Draw" in state.gameState ? (
              <Draw
                state={state.gameState.Draw}
                playDrawCardSound={state.settings.playDrawCardSound}
                autodrawSpeedMs={state.settings.autodrawSpeedMs}
                name={state.name}
                setTimeout={timerContext.setTimeout}
                clearTimeout={timerContext.clearTimeout}
              />
            ) : null}
            {"Exchange" in state.gameState ? (
              <Exchange state={state.gameState.Exchange} name={state.name} />
            ) : null}
            {"Play" in state.gameState ? (
              <Play
                playPhase={state.gameState.Play}
                name={state.name}
                showLastTrick={state.settings.showLastTrick}
                unsetAutoPlayWhenWinnerChanges={
                  state.settings.unsetAutoPlayWhenWinnerChanges
                }
                showTrickInPlayerOrder={state.settings.showTrickInPlayerOrder}
                beepOnTurn={state.settings.beepOnTurn}
              />
            ) : null}
            {state.settings.showDebugInfo ? <DebugInfo /> : null}
          </div>
          <Chat messages={state.messages} />
          <hr />
          <Credits />
          <TitleHandler playerName={state.name} />
        </div>
      );
    }
  } else if (state.everConnected) {
    return (
      <>
        <p>
          It looks like you got disconnected from the server, please refresh! If
          the game is still ongoing, you should be able to re-join with the same
          name and pick up where you left off.
        </p>
      </>
    );
  } else {
    return (
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "48px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 52, marginBottom: 12 }}>🃏</div>
        <h1>升级 · 找朋友</h1>
        <p>正在连接服务器...</p>
        <TitleHandler playerName={state.name} />
      </div>
    );
  }
};

export default Root;
