import * as React from "react";
import { createPortal } from "react-dom";
import { GuandanStateContext } from "./GuandanStateProvider";
import type { GuandanRank, GuandanTeam } from "./guandanProtocol";

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

const teamLabel = (team: GuandanTeam | null): string =>
  team === "TeamA" ? "A队" : team === "TeamB" ? "B队" : "—";

export interface GuandanRoundDisplayModel {
  level: GuandanRank;
  finishOrder: number[];
  winner: number | null;
  winnerName: string | null;
  winnerTeam: GuandanTeam | null;
  promotionSteps: number;
  rankingText: string;
}

export const buildGuandanRoundDisplayModel = (
  level: GuandanRank | null,
  players: string[],
  finishOrder: number[],
  lastGameWinner: number | null,
  lastGameWinnerTeam: GuandanTeam | null = null,
  lastPromotionSteps: number | null = null,
): GuandanRoundDisplayModel => {
  const completeFinishOrder =
    players.length >= 4 && finishOrder.length === players.length
      ? [...finishOrder]
      : [];
  const winner = lastGameWinner ?? completeFinishOrder[0] ?? null;
  const winnerName =
    winner === null ? null : (players[winner] ?? `玩家${winner + 1}`);
  const inferredTeam: GuandanTeam | null =
    winner === null ? null : winner % 2 === 0 ? "TeamA" : "TeamB";
  const winnerTeam = lastGameWinnerTeam ?? inferredTeam;

  let inferredPromotion = 0;
  if (completeFinishOrder.length === 4 && winner !== null) {
    const partner = (winner + 2) % 4;
    const partnerPlace = completeFinishOrder.indexOf(partner) + 1;
    inferredPromotion =
      partnerPlace === 2
        ? 3
        : partnerPlace === 3
          ? 2
          : partnerPlace === 4
            ? 1
            : 0;
  } else if (completeFinishOrder.length >= 4) {
    inferredPromotion = 1;
  }
  const promotionSteps = lastPromotionSteps ?? inferredPromotion;

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
    winnerTeam,
    promotionSteps,
    rankingText,
  };
};

const TeamScoreBadge = ({
  winnerTeam,
  score,
}: {
  winnerTeam: GuandanTeam | null;
  score: number;
}): React.JSX.Element => {
  const aScore = winnerTeam === "TeamA" ? score : 0;
  const bScore = winnerTeam === "TeamB" ? score : 0;
  return (
    <div
      className="guandan-level-hud guandan-round-score-hud"
      data-testid="guandan-round-score"
      aria-label={`A队计分 +${aScore}，B队计分 +${bScore}`}
    >
      <div className="guandan-level-badge">
        <span>A队计分</span>
        <strong>+{aScore}</strong>
      </div>
      <div className="guandan-level-badge">
        <span>B队计分</span>
        <strong>+{bScore}</strong>
      </div>
    </div>
  );
};

const CurrentLevelBadge = ({ level }: { level: GuandanRank }): React.JSX.Element => (
  <div className="guandan-level-hud" data-testid="guandan-current-level">
    <div className="guandan-level-badge">
      <span>本局打</span>
      <strong>{rankLabel[level]}</strong>
    </div>
  </div>
);

export const GuandanRoundResultContent = ({
  model,
}: {
  model: GuandanRoundDisplayModel;
}): React.JSX.Element => (
  <>
    <TeamScoreBadge
      winnerTeam={model.finishOrder.length > 0 ? model.winnerTeam : null}
      score={model.finishOrder.length > 0 ? model.promotionSteps : 0}
    />
    <CurrentLevelBadge level={model.level} />
    {model.finishOrder.length > 0 && (
      <section
        className="guandan-notice-panel guandan-round-result-acceptance"
        role="status"
        aria-label="本局赢家排列"
        data-testid="guandan-final-ranking"
      >
        <strong>
          本局赢家：{model.winnerName ?? "—"} ｜ {teamLabel(model.winnerTeam)}获胜 ｜ 升级 +
          {model.promotionSteps} ｜ 赢家排列：
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
    state.lastGameWinnerTeam,
    state.lastPromotionSteps,
  );
  const roundStillComplete =
    state.finishOrder.length === state.players.length && state.players.length >= 4;
  const liveScore = roundStillComplete ? model.promotionSteps : 0;
  const liveWinnerTeam = roundStillComplete ? model.winnerTeam : null;

  if (statusTarget === null && tableTarget === null) return null;

  return (
    <>
      {statusTarget !== null &&
        createPortal(
          <TeamScoreBadge winnerTeam={liveWinnerTeam} score={liveScore} />,
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
              本局赢家：{model.winnerName ?? "—"} ｜ {teamLabel(model.winnerTeam)}获胜 ｜ 升级 +
              {model.promotionSteps} ｜ 赢家排列：
            </strong>
            {model.rankingText}
          </section>,
          tableTarget,
        )}
    </>
  );
};

export default GuandanRoundResultHud;
