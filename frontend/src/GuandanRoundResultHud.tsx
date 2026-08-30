import * as React from "react";
import { createPortal } from "react-dom";
import { GuandanStateContext } from "./GuandanStateProvider";
import type { GuandanRank } from "./guandanProtocol";

const rankLabel: Record<string, string> = {
  Two: "2",
  Three: "3",
  Four: "4",
  Five: "5",
  Six: "6",
  Seven: "7",
  Eight: "8",
  Nine: "9",
  Ten: "10",
  Jack: "J",
  Queen: "Q",
  King: "K",
  Ace: "A",
};

export interface GuandanRoundDisplayModel {
  level: GuandanRank;
  finishOrder: number[];
  winner: number | null;
  winnerName: string | null;
  rankingText: string;
}

export const buildGuandanRoundDisplayModel = (
  level: GuandanRank | null,
  players: string[],
  finishOrder: number[],
  lastGameWinner: number | null,
): GuandanRoundDisplayModel => {
  const completeFinishOrder =
    players.length >= 4 && finishOrder.length === players.length
      ? [...finishOrder]
      : [];
  const winner = lastGameWinner ?? completeFinishOrder[0] ?? null;
  const winnerName =
    winner === null ? null : (players[winner] ?? `玩家${winner + 1}`);
  const rankingText = completeFinishOrder
    .map(
      (seat, index) =>
        `第${index + 1}名 ${players[seat] ?? `玩家${seat + 1}`}`,
    )
    .join(" ｜ ");

  return {
    level: level ?? "Two",
    finishOrder: completeFinishOrder,
    winner,
    winnerName,
    rankingText,
  };
};

export const GuandanRoundResultContent = ({
  model,
}: {
  model: GuandanRoundDisplayModel;
}): React.JSX.Element => (
  <>
    <div className="guandan-level-hud" data-testid="guandan-current-level">
      <div className="guandan-level-badge">
        <span>本局打</span>
        <strong>{rankLabel[model.level]}</strong>
      </div>
    </div>
    {model.finishOrder.length > 0 && (
      <section
        className="guandan-notice-panel guandan-round-result-acceptance"
        role="status"
        aria-label="本局赢家排列"
        data-testid="guandan-final-ranking"
      >
        <strong>
          本局赢家：{model.winnerName ?? "—"} ｜ 赢家排列：
        </strong>
        {model.rankingText}
      </section>
    )}
  </>
);

const GuandanRoundResultHud = (): React.JSX.Element | null => {
  const { state } = React.useContext(GuandanStateContext);
  const [statusTarget, setStatusTarget] = React.useState<Element | null>(null);
  const [tableTarget, setTableTarget] = React.useState<Element | null>(null);
  const lastCompleteFinishOrder = React.useRef<number[]>([]);

  const playerCount = state.playerCount ?? state.players.length;
  if (
    playerCount >= 4 &&
    state.finishOrder.length === playerCount &&
    state.finishOrder.length === state.players.length
  ) {
    lastCompleteFinishOrder.current = [...state.finishOrder];
  }

  React.useEffect(() => {
    setStatusTarget(document.querySelector(".guandan-status-bar"));
    setTableTarget(document.querySelector(".guandan-public-zone"));
  });

  const effectiveFinishOrder =
    state.finishOrder.length === state.players.length && state.players.length >= 4
      ? state.finishOrder
      : lastCompleteFinishOrder.current;
  const model = buildGuandanRoundDisplayModel(
    state.level,
    state.players,
    effectiveFinishOrder,
    state.lastGameWinner,
  );

  if (statusTarget === null && tableTarget === null) return null;

  return (
    <>
      {statusTarget !== null &&
        createPortal(
          <div className="guandan-level-hud" data-testid="guandan-current-level">
            <div className="guandan-level-badge">
              <span>本局打</span>
              <strong>{rankLabel[model.level]}</strong>
            </div>
          </div>,
          statusTarget,
        )}
      {tableTarget !== null && model.finishOrder.length > 0 &&
        createPortal(
          <section
            className="guandan-notice-panel guandan-round-result-acceptance"
            role="status"
            aria-label="本局赢家排列"
            data-testid="guandan-final-ranking"
          >
            <strong>
              本局赢家：{model.winnerName ?? "—"} ｜ 赢家排列：
            </strong>
            {model.rankingText}
          </section>,
          tableTarget,
        )}
    </>
  );
};

export default GuandanRoundResultHud;
