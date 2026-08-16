import * as React from "react";
import { Trump } from "./gen-types";
import InlineCard from "./InlineCard";
import preloadedCards from "./preloadedCards";

import type { JSX } from "react";

interface IProps {
  trump: Trump;
}
const TrumpE = (props: IProps): JSX.Element => {
  const { trump } = props;
  if ("Standard" in trump) {
    const { suit, number: rank } = trump.Standard;
    const card = preloadedCards.filter(
      (v) => v.typ === suit && v.number === rank,
    )[0].value;
    return (
      <div className="trump">
        主牌花色：
        <InlineCard card={card} />
        （级牌 {rank}）
      </div>
    );
  } else if (
    trump.NoTrump.number !== undefined &&
    trump.NoTrump.number !== null
  ) {
    return <div className="trump">无主，级牌 {trump.NoTrump.number}</div>;
  } else {
    return <div className="trump">无主</div>;
  }
};

export default TrumpE;
