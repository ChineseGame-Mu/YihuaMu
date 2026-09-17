import * as React from "react";
import { GuandanStateContext } from "./GuandanStateProvider";

const GuandanLastRoundScoreboard = (): React.JSX.Element => {
  const { state } = React.useContext(GuandanStateContext);
  const winner = state.lastGameWinner;
  const winnerName =
    winner === null
      ? null
      : (state.players[winner] ?? `玩家${winner + 1}`);
  const score = state.lastPromotionSteps;

  return (
    <aside
      className="guandan-last-round-scoreboard"
      role="status"
      aria-label="本局打"
      data-testid="guandan-last-round-scoreboard"
    >
      <span className="guandan-last-round-scoreboard-title">本局打</span>
      {winnerName === null ? (
        <strong>—</strong>
      ) : (
        <>
          <strong>{winnerName}</strong>
          <span className="guandan-last-round-scoreboard-score">
            +{score ?? 0}
          </span>
        </>
      )}
    </aside>
  );
};

export default GuandanLastRoundScoreboard;
