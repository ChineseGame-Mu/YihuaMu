import * as React from "react";
import Cards from "./Cards";
import {
  Bid,
  Player,
  Hands,
  Trump,
  BidPolicy,
  BidReinforcementPolicy,
  JokerBidPolicy,
} from "./gen-types";
import { WebsocketContext } from "./WebsocketProvider";
import LabeledPlay from "./LabeledPlay";
import { useEngine } from "./useEngine";

import type { JSX } from "react";

interface IBidAreaProps {
  bids: Bid[];
  autobid: Bid | null;
  trump?: Trump;
  epoch: number;
  name: string;
  landlord: number | null;
  players: Player[];
  header?: JSX.Element | JSX.Element[];
  prefixButtons?: JSX.Element | JSX.Element[];
  suffixButtons?: JSX.Element | JSX.Element[];
  bidTakeBacksEnabled: boolean;
  bidPolicy: BidPolicy;
  bidReinforcementPolicy: BidReinforcementPolicy;
  jokerBidPolicy: JokerBidPolicy;
  hands: Hands;
  numDecks: number;
}

const BidArea = (props: IBidAreaProps): JSX.Element => {
  const { send } = React.useContext(WebsocketContext);
  const engine = useEngine();
  const [validBids, setValidBids] = React.useState<Bid[]>([]);
  const [isLoadingBids, setIsLoadingBids] = React.useState<boolean>(false);
  const trump = props.trump == null ? { NoTrump: {} } : props.trump;

  const takeBackBid = (evt: React.SyntheticEvent): void => {
    evt.preventDefault();
    send({ Action: "TakeBackBid" });
  };

  const players: { [playerId: number]: Player } = {};
  let playerId = -1;
  props.players.forEach((p: Player): void => {
    players[p.id] = p;
    if (p.name === props.name) {
      playerId = p.id;
    }
  });

  React.useEffect(() => {
    if (playerId >= 0) {
      setIsLoadingBids(true);
      engine
        .findValidBids({
          id: playerId,
          bids: props.bids,
          hands: props.hands,
          players: props.players,
          landlord: props.landlord,
          epoch: props.epoch,
          bid_policy: props.bidPolicy,
          bid_reinforcement_policy: props.bidReinforcementPolicy,
          joker_bid_policy: props.jokerBidPolicy,
          num_decks: props.numDecks,
        })
        .then((bids) => {
          bids.sort((a, b) => {
            if (a.card < b.card) return -1;
            if (a.card > b.card) return 1;
            if (a.count < b.count) return -1;
            if (a.count > b.count) return 1;
            return 0;
          });
          setValidBids(bids);
          setIsLoadingBids(false);
        })
        .catch((error) => {
          console.error("查找有效叫主选项时出错：", error);
          setValidBids([]);
          setIsLoadingBids(false);
        });
    }
  }, [
    playerId,
    props.bids,
    props.hands,
    props.players,
    props.landlord,
    props.epoch,
    props.bidPolicy,
    props.bidReinforcementPolicy,
    props.jokerBidPolicy,
    props.numDecks,
    engine,
  ]);

  if (playerId === null || playerId < 0) {
    return (
      <div>
        {props.header}
        {props.autobid !== null ? (
          <LabeledPlay
            label={`${players[props.autobid.id].name}（底牌定主）`}
            trump={trump}
            cards={[props.autobid.card]}
          />
        ) : null}
        {props.bids.map((bid, idx) => {
          const name = players[bid.id].name;
          return (
            <LabeledPlay
              label={name}
              key={idx}
              trump={trump}
              cards={Array(bid.count).fill(bid.card)}
            />
          );
        })}
        {props.bids.length === 0 && props.autobid === null ? (
          <LabeledPlay trump={trump} label={"还没有人叫主……"} cards={["🂠"]} />
        ) : null}
      </div>
    );
  } else {
    const levelId =
      props.landlord !== null && props.landlord !== undefined
        ? props.landlord
        : playerId;

    const trump: any =
      props.trump !== null && props.trump !== undefined
        ? props.trump
        : {
            NoTrump: {
              number:
                players[levelId].level !== "NT" ? players[levelId].level : null,
            },
          };

    return (
      <div>
        <div>
          {props.header}
          {props.autobid !== null ? (
            <LabeledPlay
              label={`${players[props.autobid.id].name}（底牌定主）`}
              cards={[props.autobid.card]}
              trump={trump}
            />
          ) : null}
          {props.bids.map((bid, idx) => {
            const name = players[bid.id].name;
            return (
              <LabeledPlay
                label={name}
                key={idx}
                trump={trump}
                cards={Array(bid.count).fill(bid.card)}
              />
            );
          })}
          {props.trump !== undefined &&
          "NoTrump" in props.trump &&
          props.trump?.NoTrump?.number === null ? (
            <>无主状态下不能再叫主！</>
          ) : props.bids.length === 0 && props.autobid === null ? (
            <LabeledPlay trump={trump} label={"还没有人叫主……"} cards={["🂠"]} />
          ) : null}
        </div>
        {props.prefixButtons}
        {props.bidTakeBacksEnabled ? (
          <button
            onClick={takeBackBid}
            disabled={
              props.bids.length === 0 ||
              props.bids[props.bids.length - 1].id !== playerId ||
              props.bids[props.bids.length - 1].epoch !== props.epoch
            }
            className="big"
          >
            撤回叫主
          </button>
        ) : null}
        {props.suffixButtons}
        {isLoadingBids ? (
          <p>正在加载叫主选项……</p>
        ) : validBids.length > 0 ? (
          <p>点击下面的牌进行叫主</p>
        ) : (
          <p>目前没有可用的叫主选项！</p>
        )}
        {!isLoadingBids &&
          validBids.map((bid, idx) => {
            return (
              <LabeledPlay
                trump={trump}
                cards={Array(bid.count).fill(bid.card)}
                key={idx}
                label={`叫主选项 ${idx + 1}`}
                onClick={() => {
                  send({ Action: { Bid: [bid.card, bid.count] } });
                }}
              />
            );
          })}
        <Cards hands={props.hands} playerId={playerId} trump={trump} />
      </div>
    );
  }
};

export default BidArea;
