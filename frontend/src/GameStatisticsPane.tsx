import * as React from "react";
import { GameStatistics } from "./state/GameStatistics";
import styled from "styled-components";

import type { JSX } from "react";

const Row = styled.div`
  display: table-row;
  line-height: 23px;
`;
const LabelCell = styled.div`
  display: table-cell;
  padding-right: 2em;
  font-weight: bold;
`;
const Cell = styled.div`
  display: table-cell;
`;

const percentage = (numerator: number, denominator: number): string => {
  if (denominator > 0) {
    return ((numerator / denominator) * 100).toFixed(2) + "%";
  }
  return "无数据";
};

const ranksPerGame = (ranks: number, numGames: number): string => {
  if (numGames > 0) {
    return (ranks / numGames).toFixed(3);
  }
  return "无数据";
};

interface RowIProps {
  label: string;
  numPlayed: number;
  numWon: number;
}

const GameStatisticsRow = ({
  label,
  numPlayed,
  numWon,
}: RowIProps): JSX.Element => {
  return (
    <Row>
      <LabelCell>{label}</LabelCell>
      <Cell>{numPlayed}</Cell>
      <Cell>{numWon}</Cell>
      <Cell>{percentage(numWon, numPlayed)}</Cell>
    </Row>
  );
};

interface IProps {
  gameStatistics: GameStatistics;
}

const GameStatisticsPane = (props: IProps): JSX.Element => {
  const { gameStatistics } = props;

  const gamesPlayedAsAttacking =
    gameStatistics.gamesPlayed - gameStatistics.gamesPlayedAsDefending;
  const gamesWonAsAttacking =
    gameStatistics.gamesWon - gameStatistics.gamesWonAsDefending;

  return (
    <div className="gameStatistics">
      <h3>胜负统计</h3>
      <div style={{ display: "table" }}>
        <Row>
          <Cell />
          <LabelCell>局数</LabelCell>
          <LabelCell>获胜</LabelCell>
          <LabelCell>胜率</LabelCell>
        </Row>
        <GameStatisticsRow
          label={"闲家"}
          numPlayed={gamesPlayedAsAttacking}
          numWon={gamesWonAsAttacking}
        />
        <GameStatisticsRow
          label={"庄家队"}
          numPlayed={gameStatistics.gamesPlayedAsDefending}
          numWon={gameStatistics.gamesWonAsDefending}
        />
        <GameStatisticsRow
          label={"担任庄家"}
          numPlayed={gameStatistics.gamesPlayedAsLandlord}
          numWon={gameStatistics.gamesWonAsLandlord}
        />
        <GameStatisticsRow
          label={"总计"}
          numPlayed={gameStatistics.gamesPlayed}
          numWon={gameStatistics.gamesWon}
        />
      </div>
      <h3>升级统计</h3>
      <div style={{ display: "table" }}>
        <Row>
          <LabelCell>平均每局升级级数</LabelCell>
          <Cell>{ranksPerGame(gameStatistics.ranksUp, gameStatistics.gamesPlayed)}</Cell>
        </Row>
        <Row>
          <LabelCell>平均每胜局升级级数</LabelCell>
          <Cell>{ranksPerGame(gameStatistics.ranksUp, gameStatistics.gamesWon)}</Cell>
        </Row>
      </div>
    </div>
  );
};

export default GameStatisticsPane;
