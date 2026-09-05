import * as React from "react";
import { createPortal } from "react-dom";
import { GuandanStateContext } from "./GuandanStateProvider";
import type { GuandanRank, GuandanTeam } from "./guandanProtocol";

const rankSequence: GuandanRank[] = [
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Jack",
  "Queen",
  "King",
  "Ace",
];

const rankFromCumulativeScore = (score: number): GuandanRank =>
  rankSequence[Math.min(rankSequence.length - 1, Math.max(0, score))] ?? "Two";

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
      (seat, index) => `第${index + 1}名 ${players[seat] ?? `玩家${seat + 1}`}`,
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

interface TeamScores {
  a: number;
  b: number;
}

const emptyScores: TeamScores = { a: 0, b: 0 };

const scoreStorageKey = (room: string | null): string =>
  `guandan_team_scores_${room ?? "unknown"}`;

const scoreSignatureKey = (room: string | null): string =>
  `guandan_team_score_signature_${room ?? "unknown"}`;

const loadScores = (room: string | null): TeamScores => {
  try {
    const raw = window.localStorage.getItem(scoreStorageKey(room));
    if (raw === null) return emptyScores;
    const parsed = JSON.parse(raw) as Partial<TeamScores>;
    return {
      a: Number.isFinite(parsed.a) ? Number(parsed.a) : 0,
      b: Number.isFinite(parsed.b) ? Number(parsed.b) : 0,
    };
  } catch {
    return emptyScores;
  }
};

const TeamScoreBadge = ({
  scores,
}: {
  scores: TeamScores;
}): React.JSX.Element => (
  <div
    className="guandan-level-hud guandan-round-score-hud"
    data-testid="guandan-round-score"
    aria-label={`A队计分 ${scores.a}，B队计分 ${scores.b}`}
  >
    <div className="guandan-level-badge">
      <span>A队计分</span>
      <strong>{scores.a}</strong>
    </div>
    <div className="guandan-level-badge">
      <span>B队计分</span>
      <strong>{scores.b}</strong>
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
      scores={
        model.winnerTeam === "TeamA"
          ? { a: model.promotionSteps, b: 0 }
          : model.winnerTeam === "TeamB"
            ? { a: 0, b: model.promotionSteps }
            : emptyScores
      }
    />
    {model.finishOrder.length > 0 && (
      <section
        className="guandan-notice-panel guandan-round-result-acceptance"
        role="status"
        aria-label="本局赢家排列"
        data-testid="guandan-final-ranking"
      >
        <strong>
          本局赢家：{model.winnerName ?? "—"} ｜ {teamLabel(model.winnerTeam)}
          获胜 ｜ 本局计分 +{model.promotionSteps} ｜ 赢家排列：
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
  const [teamScores, setTeamScores] = React.useState<TeamScores>(() =>
    loadScores(state.room),
  );
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

  React.useEffect(() => {
    setTeamScores(loadScores(state.room));
  }, [state.room]);

  const effectiveFinishOrder =
    state.finishOrder.length === state.players.length &&
    state.players.length >= 4
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
    state.finishOrder.length === state.players.length &&
    state.players.length >= 4;

  React.useEffect(() => {
    if (
      !roundStillComplete ||
      model.winnerTeam === null ||
      model.promotionSteps <= 0
    )
      return;
    const signature = `${state.players.join("|")}::${state.finishOrder.join(",")}::${model.winnerTeam}::${model.promotionSteps}`;
    const signatureKey = scoreSignatureKey(state.room);
    if (window.localStorage.getItem(signatureKey) === signature) return;

    setTeamScores((current) => {
      const next =
        model.winnerTeam === "TeamA"
          ? { a: current.a + model.promotionSteps, b: current.b }
          : { a: current.a, b: current.b + model.promotionSteps };
      window.localStorage.setItem(
        scoreStorageKey(state.room),
        JSON.stringify(next),
      );
      window.localStorage.setItem(signatureKey, signature);
      return next;
    });
  }, [
    roundStillComplete,
    model.winnerTeam,
    model.promotionSteps,
    state.finishOrder,
    state.players,
    state.room,
  ]);

  // Keep cumulative-score synchronization available for game logic, but do not
  // render a separate level badge in the top HUD.
  if (model.winnerTeam === "TeamA") rankFromCumulativeScore(teamScores.a);
  if (model.winnerTeam === "TeamB") rankFromCumulativeScore(teamScores.b);

  if (statusTarget === null && tableTarget === null) return null;

  return (
    <>
      {statusTarget !== null &&
        createPortal(<TeamScoreBadge scores={teamScores} />, statusTarget)}
      {tableTarget !== null &&
        model.finishOrder.length > 0 &&
        createPortal(
          <section
            className="guandan-notice-panel guandan-round-result-acceptance"
            role="status"
            aria-label="本局赢家排列"
            data-testid="guandan-final-ranking"
          >
            <strong>
              本局赢家：{model.winnerName ?? "—"} ｜{" "}
              {teamLabel(model.winnerTeam)}获胜 ｜ 本局计分 +
              {model.promotionSteps} ｜ 赢家累计积分：
              {model.winnerTeam === "TeamA"
                ? teamScores.a
                : teamScores.b} ｜ 赢家排列：
            </strong>
            {model.rankingText}
          </section>,
          tableTarget,
        )}
    </>
  );
};

export default GuandanRoundResultHud;
