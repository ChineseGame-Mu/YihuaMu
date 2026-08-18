import * as React from "react";
import classNames from "classnames";
import Errors from "./Errors";
import Initialize from "./Initialize";
import Draw from "./Draw";
import Exchange from "./Exchange";
import JoinRoom, { ROOM_CODE_LENGTH } from "./JoinRoom";
import { AppStateContext } from "./AppStateProvider";
import { TimerContext } from "./TimerProvider";
import Credits from "./Credits";
import Chat from "./Chat";
import Play from "./Play";
import DebugInfo from "./DebugInfo";
import TitleHandler from "./TitleHandler";
import ResetButton from "./ResetButton";
import Welcome from "./Welcome";

import type { JSX } from "react";

const Confetti = React.lazy(async () => await import("./Confetti"));

type GameModeChoice = "Tractor" | "FindingFriends";

const Root = (): JSX.Element => {
  const { state, updateState } = React.useContext(AppStateContext);
  const timerContext = React.useContext(TimerContext);
  const [selectedGameMode, setSelectedGameMode] =
    React.useState<GameModeChoice | null>(null);

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

  // A valid room code in a shared URL always takes precedence over the welcome screen.
  const hasSharedRoom = state.roomName.length === ROOM_CODE_LENGTH;

  if (state.connected) {
    if (state.gameState === null || !hasSharedRoom) {
      if (selectedGameMode === null && !hasSharedRoom) {
        return (
          <div className="welcome-shell">
            {headerMessages}
            <Errors errors={state.errors} />
            <Welcome connected onSelectGameMode={setSelectedGameMode} />
            <Credits />
            <TitleHandler playerName={state.name} />
          </div>
        );
      }

      return (
        <div>
          {headerMessages}
          <Errors errors={state.errors} />
          <div className="game">
            <h1>
              升级 / <span className="red">Tractor</span> / 找朋友 /{" "}
              <span className="red">Finding Friends</span>
            </h1>
            {hasSharedRoom && selectedGameMode === null ? (
              <p>
                正在进入朋友分享的房间：<strong>{state.roomName}</strong>
              </p>
            ) : (
              <p>
                当前模式：
                <strong>
                  {selectedGameMode === "Tractor" ? "升级 / 拖拉机" : "找朋友"}
                </strong>{" "}
                <button
                  className="normal"
                  onClick={() => setSelectedGameMode(null)}
                >
                  重新选择
                </button>
              </p>
            )}
            <JoinRoom
              name={state.name}
              room_name={state.roomName}
              gameMode={selectedGameMode ?? undefined}
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
    }

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
            <Initialize state={state.gameState.Initialize} name={state.name} />
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

  if (state.everConnected) {
    return (
      <>
        <p>
          It looks like you got disconnected from the server, please refresh! If
          the game is still ongoing, you should be able to re-join with the same
          name and pick up where you left off.
        </p>
      </>
    );
  }

  if (hasSharedRoom) {
    return (
      <div>
        <div className="game">
          <h1>
            升级 / <span className="red">Tractor</span> / 找朋友 /{" "}
            <span className="red">Finding Friends</span>
          </h1>
          <p>
            正在连接朋友分享的房间：<strong>{state.roomName}</strong>
          </p>
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
  }

  return (
    <div className="welcome-shell">
      <Welcome />
      <Credits />
      <TitleHandler playerName={state.name} />
    </div>
  );
};

export default Root;
