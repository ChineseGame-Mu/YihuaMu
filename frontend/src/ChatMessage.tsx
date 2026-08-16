import * as React from "react";
import InlineCard from "./InlineCard";
import classNames from "classnames";
import ArrayUtil from "./util/array";
import { BroadcastMessage } from "./gen-types";

import type { JSX } from "react";

export interface Message {
  from: string;
  message: string;
  data?: BroadcastMessage;
  from_game?: boolean;
}

const renderMessage = (message: Message): JSX.Element => {
  const variant = message.data?.variant;
  switch (variant?.type) {
    case "MadeBid":
      return (
        <span>
          {message.data?.actor_name} 叫主：{" "}
          {ArrayUtil.range(variant.count, (i) => (
            <InlineCard card={variant.card} key={i} />
          ))}
        </span>
      );
    case "PlayedCards":
      return (
        <span>
          {message.data?.actor_name} 出牌：{" "}
          {variant.cards.map((card, i) => (
            <InlineCard card={card} key={i} />
          ))}
        </span>
      );
    case "EndOfGameKittyReveal":
      return (
        <span>
          底牌：{" "}
          {variant.cards.map((card, i) => (
            <InlineCard card={card} key={i} />
          ))}
        </span>
      );
    case "GameScoringParametersChanged":
      return renderScoringMessage(message);
    default:
      return <span>{message.message}</span>;
  }
};

const renderScoringMessage = (message: Message): JSX.Element => {
  const changes = [];
  const variant = message.data?.variant;
  if (variant?.type === "GameScoringParametersChanged") {
    if (
      variant.old_parameters.step_size_per_deck !==
      variant.parameters.step_size_per_deck
    ) {
      changes.push(
        <span key={changes.length}>
          每副牌计分步长：{variant.parameters.step_size_per_deck} 分
        </span>,
      );
    }
    if (
      variant.old_parameters.deadzone_size !== variant.parameters.deadzone_size
    ) {
      changes.push(
        <span key={changes.length}>
          不升级区间：{variant.parameters.deadzone_size}{" "}
        </span>,
      );
    }
    if (
      variant.old_parameters.num_steps_to_non_landlord_turnover !==
      variant.parameters.num_steps_to_non_landlord_turnover
    ) {
      changes.push(
        <span key={changes.length}>
          闲家翻庄所需步数：{" "}
          {variant.parameters.num_steps_to_non_landlord_turnover}{" "}
        </span>,
      );
    }
    for (const k in variant.parameters.step_adjustments) {
      const adj = variant.parameters.step_adjustments[k];
      if (adj !== variant.old_parameters.step_adjustments[k]) {
        changes.push(
          <span key={changes.length}>
            {k} 副牌步长调整为 {adj}{" "}
          </span>,
        );
      }
    }
    for (const k in variant.old_parameters.step_adjustments) {
      const adj = variant.parameters.step_adjustments[k];
      if (adj === undefined || adj === null || adj === 0) {
        changes.push(
          <span key={changes.length}>已取消 {k} 副牌的步长调整 </span>,
        );
      }
    }
    if (
      variant.old_parameters.bonus_level_policy !==
      variant.parameters.bonus_level_policy
    ) {
      if (
        variant.parameters.bonus_level_policy ===
        "BonusLevelForSmallerLandlordTeam"
      ) {
        changes.push(<span key={changes.length}>已开启少人数庄家队奖励</span>);
      } else {
        changes.push(<span key={changes.length}>已关闭少人数庄家队奖励</span>);
      }
    }
    return (
      <span>
        {message.data?.actor_name} 更新了计分设置：{changes}
      </span>
    );
  } else {
    return <></>;
  }
};

interface IProps {
  message: Message;
}
const ChatMessage = (props: IProps): JSX.Element => {
  const { message } = props;
  return (
    <>
      {message.data?.variant.type === "StartingGame" ? (
        <p
          className={classNames("message", {
            "game-message": message.from_game,
          })}
        >
          🚜 🚜 🚜 🚜 🚜 🚜 🚜 🚜 🚜 🚜 🚜 🚜
        </p>
      ) : null}
      <p
        className={classNames("message", { "game-message": message.from_game })}
      >
        {"from" in message && <span>{message.from}: </span>}
        {renderMessage(message)}
      </p>
    </>
  );
};

export default ChatMessage;
