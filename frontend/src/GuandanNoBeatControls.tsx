import * as React from "react";

import { GuandanStateContext } from "./GuandanStateProvider";
import { handCanBeat } from "./GuandanNoBeatHint";

const GuandanNoBeatControls: React.FunctionComponent = () => {
  const { state } = React.useContext(GuandanStateContext);

  const noBeat = React.useMemo(() => {
    const shouldCheck =
      state.seat !== null &&
      state.turn === state.seat &&
      state.lastPlayer !== null &&
      state.lastPlay.length > 0 &&
      state.level !== null &&
      state.pendingTribute === null &&
      !state.trickComplete &&
      state.hand.length > 0;

    return (
      shouldCheck &&
      state.level !== null &&
      !handCanBeat(state.hand, state.lastPlay, state.level)
    );
  }, [
    state.seat,
    state.turn,
    state.lastPlayer,
    state.lastPlay,
    state.level,
    state.pendingTribute,
    state.trickComplete,
    state.hand,
  ]);

  React.useEffect(() => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        ".guandan-play-actions button",
      ),
    );
    const playButton = buttons.find(
      (button) => button.textContent?.trim() === "出牌",
    );
    const passButton = buttons.find(
      (button) => button.textContent?.trim() === "过牌",
    );

    if (playButton !== undefined) {
      if (noBeat) {
        playButton.dataset.noBeatDisabled = "true";
        playButton.disabled = true;
      } else if (playButton.dataset.noBeatDisabled === "true") {
        delete playButton.dataset.noBeatDisabled;
      }
    }

    if (passButton !== undefined) {
      if (noBeat && !passButton.disabled) {
        passButton.style.fontWeight = "800";
        passButton.style.transform = "scale(1.08)";
        passButton.style.boxShadow = "0 0 0 2px currentColor";
      } else {
        passButton.style.fontWeight = "";
        passButton.style.transform = "";
        passButton.style.boxShadow = "";
      }
    }
  }, [noBeat, state.hand, state.lastPlay, state.turn]);

  return null;
};

export default GuandanNoBeatControls;
