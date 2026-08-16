import * as React from "react";
import ProgressBar from "./ProgressBar";
import {
  Player,
  GameScoringParameters,
  Deck,
  Trump,
  ComputeScoreResponse,
  ScoreSegment,
  ExplainScoringResponse,
} from "./gen-types";
import ArrayUtils from "./util/array";
import ObjectUtils from "./util/object";
import LabeledPlay from "./LabeledPlay";
import classNames from "classnames";
import { cardLookup } from "./util/cardHelpers";
import { useEngine } from "./useEngine";
import { SettingsContext } from "./AppStateProvider";
import { explainScoringCache, getExplainScoringKey } from "./util/cachePrefill";

import type { JSX } from "react";

interface IProps {
  players: Player[];
  decks: Deck[];
  points: { [playerId: number]: string[] };
  penalties: { [playerId: number]: number };
  landlordTeam: number[];
  landlord: number;
  trump: Trump;
  hideLandlordPoints: boolean;
  smallerTeamSize: boolean;
  gameScoringParameters: GameScoringParameters;
}

export const calculatePoints = (
  players: Player[],
  landlordTeam: number[],
  points: { [playerId: number]: string[] },
  penalties: { [playerId: number]: number },
): {
  nonLandlordPoints: number;
  totalPointsPlayed: number;
  nonLandlordPointsWithPenalties: number;
} => {
  const pointsPerPlayer = ObjectUtils.mapValues(points, (cards) =>
    ArrayUtils.sum(cards.map((card) => cardLookup[card].points)),
  );
  const totalPointsPlayed = ArrayUtils.sum(Object.values(pointsPerPlayer));
  const nonLandlordPoints = ArrayUtils.sum(
    players
      .filter((p) => !landlordTeam.includes(p.id))
      .map((p) => pointsPerPlayer[p.id]),
  );

  let nonLandlordPointsWithPenalties = nonLandlordPoints;
  players.forEach((p) => {
    const penalty = penalties[p.id];
    if (penalty > 0) {
      if (landlordTeam.includes(p.id)) {
        nonLandlordPointsWithPenalties += penalty;
      } else {
        nonLandlordPointsWithPenalties -= penalty;
      }
    }
  });

  return {
    nonLandlordPoints,
    nonLandlordPointsWithPenalties,
    totalPointsPlayed,
  };
};

const Points = (props: IProps): JSX.Element => {
  const pointsPerPlayer = ObjectUtils.mapValues(props.points, (cards) =>
    ArrayUtils.sum(cards.map((card) => cardLookup[card].points)),
  );
  const settings = React.useContext(SettingsContext);
  const engine = useEngine();
  const [scoreData, setScoreData] = React.useState<ComputeScoreResponse | null>(
    null,
  );
  const [scoreTransitions, setScoreTransitions] = React.useState<
    ScoreSegment[]
  >([]);
  const [totalPoints, setTotalPoints] = React.useState<number>(100);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  const {
    totalPointsPlayed,
    nonLandlordPointsWithPenalties,
    nonLandlordPoints,
  } = calculatePoints(
    props.players,
    props.landlordTeam,
    props.points,
    props.penalties,
  );
  const penaltyDelta = nonLandlordPointsWithPenalties - nonLandlordPoints;

  React.useEffect(() => {
    setIsLoading(true);

    const loadData = async () => {
      try {
        const scoringKey = getExplainScoringKey(
          props.gameScoringParameters,
          props.smallerTeamSize,
          props.decks,
        );
        let scoringResult = explainScoringCache[scoringKey];

        const promises: Promise<
          ComputeScoreResponse | ExplainScoringResponse
        >[] = [
          engine.computeScore({
            params: props.gameScoringParameters,
            decks: props.decks,
            smaller_landlord_team_size: props.smallerTeamSize,
            non_landlord_points: nonLandlordPointsWithPenalties,
          }),
        ];

        if (!scoringResult) {
          promises.push(
            engine.explainScoring({
              params: props.gameScoringParameters,
              smaller_landlord_team_size: props.smallerTeamSize,
              decks: props.decks,
            }),
          );
        }

        const results = await Promise.all(promises);
        const scoreResult = results[0] as ComputeScoreResponse;

        if (!scoringResult && results.length > 1) {
          scoringResult = results[1] as ExplainScoringResponse;
          explainScoringCache[scoringKey] = scoringResult;
        }

        setScoreData(scoreResult);
        setScoreTransitions(scoringResult.results);
        setTotalPoints(scoringResult.total_points);
        setIsLoading(false);
      } catch (error) {
        console.error("Error computing score:", error);
        setScoreData({
          score: {
            landlord_won: false,
            landlord_bonus: false,
            landlord_delta: 0,
            non_landlord_delta: 0,
          },
          next_threshold: 0,
        });
        setScoreTransitions([]);
        setTotalPoints(100);
        setIsLoading(false);
      }
    };

    loadData();
  }, [
    props.gameScoringParameters,
    props.decks,
    props.smallerTeamSize,
    nonLandlordPointsWithPenalties,
    engine,
  ]);

  if (isLoading || !scoreData) {
    return <div>正在计算分数……</div>;
  }

  const { score, next_threshold: nextThreshold } = scoreData;

  const playerPointElements = props.players.map((player) => {
    const onLandlordTeam = props.landlordTeam.includes(player.id);
    const cards =
      props.points[player.id].length > 0 ? props.points[player.id] : ["🂠"];
    const penalty =
      player.id in props.penalties ? props.penalties[player.id] : 0;

    if (props.hideLandlordPoints && onLandlordTeam) {
      return null;
    } else {
      return (
        <LabeledPlay
          key={player.id}
          trump={props.trump}
          className={classNames({ landlord: onLandlordTeam })}
          label={`${player.name}: ${pointsPerPlayer[player.id] - penalty}分`}
          cards={cards}
        />
      );
    }
  });

  const landlord = props.players.find((p) => p.id === props.landlord);

  let thresholdStr = "";
  if (score.landlord_won) {
    thresholdStr = `${landlord?.name} 所在庄家方将升 ${score.landlord_delta} 级`;
    if (score.landlord_bonus) {
      thresholdStr += "（包含少人数奖励）";
    }
  } else if (score.non_landlord_delta === 0) {
    thresholdStr = "双方都不升级";
  } else {
    thresholdStr = `闲家方将升 ${score.non_landlord_delta} 级`;
  }

  thresholdStr += `（下一分界：${nextThreshold}分）`;

  return (
    <div className="points">
      <h2>分数</h2>
      {!settings.showPointsAboveGame && (
        <ProgressBar
          checkpoints={scoreTransitions
            .map((transition) => transition.point_threshold)
            .filter((threshold) => threshold >= 10 && threshold < totalPoints)}
          totalPoints={totalPoints}
          landlordPoints={totalPointsPlayed - nonLandlordPoints}
          challengerPoints={nonLandlordPointsWithPenalties}
          hideLandlordPoints={props.hideLandlordPoints}
        />
      )}
      <p>
        闲家方已从 {landlord?.name} 所在庄家方拿到{" "}
        {penaltyDelta === 0
          ? nonLandlordPoints
          : `${nonLandlordPoints} + ${penaltyDelta}`}
        分{props.hideLandlordPoints ? null : ` / 已出现总分 ${totalPointsPlayed}分`}。{" "}
        {thresholdStr}
      </p>
      {playerPointElements}
    </div>
  );
};

export const ProgressBarDisplay = (props: IProps): JSX.Element => {
  const engine = useEngine();
  const [scoreTransitions, setScoreTransitions] = React.useState<
    ScoreSegment[]
  >([]);
  const [totalPoints, setTotalPoints] = React.useState<number>(0);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  const {
    totalPointsPlayed,
    nonLandlordPointsWithPenalties,
    nonLandlordPoints,
  } = calculatePoints(
    props.players,
    props.landlordTeam,
    props.points,
    props.penalties,
  );

  React.useEffect(() => {
    setIsLoading(true);

    const loadScoring = async () => {
      try {
        const scoringKey = getExplainScoringKey(
          props.gameScoringParameters,
          props.smallerTeamSize,
          props.decks,
        );
        let result = explainScoringCache[scoringKey];

        if (!result) {
          result = await engine.explainScoring({
            params: props.gameScoringParameters,
            smaller_landlord_team_size: props.smallerTeamSize,
            decks: props.decks,
          });
          explainScoringCache[scoringKey] = result;
        }

        setScoreTransitions(result.results);
        setTotalPoints(result.total_points);
        setIsLoading(false);
      } catch (error) {
        console.error("Error explaining scoring:", error);
        setScoreTransitions([]);
        setTotalPoints(100);
        setIsLoading(false);
      }
    };

    loadScoring();
  }, [props.gameScoringParameters, props.smallerTeamSize, props.decks, engine]);

  if (isLoading) {
    return <div>正在加载分数进度……</div>;
  }

  return (
    <ProgressBar
      checkpoints={scoreTransitions
        .map((transition) => transition.point_threshold)
        .filter((threshold) => threshold >= 10 && threshold < totalPoints)}
      totalPoints={totalPoints}
      landlordPoints={totalPointsPlayed - nonLandlordPoints}
      challengerPoints={nonLandlordPointsWithPenalties}
      hideLandlordPoints={props.hideLandlordPoints}
    />
  );
};

export default Points;
