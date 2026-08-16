import * as React from "react";
import { GameMode } from "./gen-types";
import InlineCard from "./InlineCard";

import type { JSX } from "react";

interface IProps {
  gameMode: GameMode;
  showPlayed: boolean;
}

const Friends = (props: IProps): JSX.Element => {
  const { gameMode } = props;
  if (gameMode !== "Tractor") {
    return (
      <div className="pending-friends">
        {gameMode.FindingFriends.friends.map((friend, idx) => {
          if (friend.player_id !== null) {
            return null;
          }

          if (
            friend.card === null ||
            friend.card === undefined ||
            friend.card.length === 0
          ) {
            return null;
          }
          return (
            <p key={idx}>
              第 {friend.initial_skip + 1} 次打出 <InlineCard card={friend.card} /> 的玩家是朋友。{" "}
              {props.showPlayed
                ? `此前各轮已经出现 ${friend.initial_skip - friend.skip} 次。`
                : ""}
            </p>
          );
        })}
      </div>
    );
  } else {
    return <></>;
  }
};

export default Friends;
