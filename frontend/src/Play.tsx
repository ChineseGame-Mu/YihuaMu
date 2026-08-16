import * as React from "react";
import { Tooltip } from "react-tooltip";
import ReactModal from "react-modal";
import {
  PlayPhase,
  TrickFormat,
  Hands,
  TrickDrawPolicy,
  FoundViablePlay,
  SuitGroup,
} from "./gen-types";
import Header from "./Header";
import Beeper from "./Beeper";
import Trump from "./Trump";
import Friends from "./Friends";
import Trick from "./Trick";
import Cards from "./Cards";
import Points, { calculatePoints, ProgressBarDisplay } from "./Points";
import LabeledPlay from "./LabeledPlay";
import Players from "./Players";
import ArrayUtils from "./util/array";
import AutoPlayButton from "./AutoPlayButton";
import BeepButton from "./BeepButton";
import { WebsocketContext } from "./WebsocketProvider";
import { SettingsContext } from "./AppStateProvider";
import { useEngine } from "./useEngine";
import InlineCard from "./InlineCard";
import {
  prefillCardInfoCache,
  prefillExplainScoringCache,
} from "./util/cachePrefill";

import type { JSX } from "react";

const contentStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
};

interface IProps {
  playPhase: PlayPhase;
  name: string;
  beepOnTurn: boolean;
  showLastTrick: boolean;
  unsetAutoPlayWhenWinnerChanges: boolean;
  showTrickInPlayerOrder: boolean;
}

const Play = (props: IProps): JSX.Element => {
  const { send } = React.useContext(WebsocketContext);
  const settings = React.useContext(SettingsContext);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [grouping, setGrouping] = React.useState<FoundViablePlay[]>([]);
  const engine = useEngine();
  const [lastPrefillTrump, setLastPrefillTrump] = React.useState<string | null>(
    null,
  );

  const updateSelectionAndGrouping = async (
    newSelected: string[],
    trump: any,
    tractorRequirements: any,
  ) => {
    setSelected(newSelected);
    try {
      const plays = await engine.findViablePlays(
        trump,
        tractorRequirements,
        newSelected,
      );
      setGrouping(plays);
    } catch (error) {
      console.error("Error finding viable plays:", error);
      setGrouping([]);
    }
  };

  const playCards = (): void => {
    send({ Action: { PlayCardsWithHint: [selected, grouping[0].grouping] } });
    setSelected([]);
    setGrouping([]);
  };

  const sendEvent = (event: object) => () => send(event);
  const takeBackCards = sendEvent({ Action: "TakeBackCards" });
  const endTrick = sendEvent({ Action: "EndTrick" });
  const endGameEarly = sendEvent({ Action: "EndGameEarly" });
  const startNewGame = sendEvent({ Action: "StartNewGame" });

  const { playPhase } = props;

  let isSpectator = true;
  let currentPlayer = playPhase.propagated.players.find(
    (p) => p.name === props.name,
  );
  if (currentPlayer === undefined) {
    currentPlayer = playPhase.propagated.observers.find(
      (p) => p.name === props.name,
    );
  } else {
    isSpectator = false;
  }
  if (currentPlayer === undefined) {
    currentPlayer = {
      id: -1,
      name: props.name,
      level: "",
      metalevel: 0,
    };
  }

  React.useEffect(() => {
    const trumpKey = JSON.stringify(playPhase.trump);

    if (trumpKey !== lastPrefillTrump) {
      setLastPrefillTrump(trumpKey);

      prefillCardInfoCache(engine, playPhase.trump).catch((error) => {
        console.error("Failed to prefill card info cache:", error);
      });

      if (playPhase.propagated.game_scoring_parameters && playPhase.decks) {
        prefillExplainScoringCache(
          engine,
          playPhase.propagated.game_scoring_parameters,
          playPhase.decks,
        ).catch((error) => {
          console.error("Failed to prefill explainScoring cache:", error);
        });
      }
    }
  }, [
    playPhase.trump,
    playPhase.propagated.game_scoring_parameters,
    playPhase.decks,
    engine,
    lastPrefillTrump,
  ]);

  React.useEffect(() => {
    const hand =
      currentPlayer.id in playPhase.hands.hands
        ? { ...playPhase.hands.hands[currentPlayer.id] }
        : {};
    selected.forEach((card) => {
      if (card in hand) {
        hand[card] = hand[card] - 1;
      } else {
        hand[card] = -1;
      }
    });

    const toRemove = Object.entries(hand)
      .filter((x) => x[1] < 0)
      .map((x) => x[0]);

    const newSelected = ArrayUtils.minus(selected, toRemove);

    if (toRemove.length > 0) {
      updateSelectionAndGrouping(
        newSelected,
        playPhase.trump,
        playPhase.propagated.tractor_requirements!,
      );
    }
  }, [playPhase.hands.hands, currentPlayer.id, selected]);

  const nextPlayer = playPhase.trick.player_queue[0];
  const lastPlay =
    playPhase.trick.played_cards[playPhase.trick.played_cards.length - 1];

  const [canPlay, setCanPlay] = React.useState(false);

  React.useEffect(() => {
    if (!isSpectator && selected.length > 0) {
      engine
        .canPlayCards({
          trick: playPhase.trick,
          id: currentPlayer!.id,
          hands: playPhase.hands,
          cards: selected,
          trick_draw_policy: playPhase.propagated.trick_draw_policy!,
        })
        .then((playable) => {
          if (lastPlay === undefined) {
            playable = playable && grouping.length === 1;
          }
          playable = playable && !playPhase.game_ended_early;
          setCanPlay(playable);
        })
        .catch((error) => {
          console.error("Error checking if cards can be played:", error);
          setCanPlay(false);
        });
    } else {
      setCanPlay(false);
    }
  }, [
    playPhase.trick,
    currentPlayer.id,
    playPhase.hands,
    selected,
    playPhase.propagated.trick_draw_policy,
    isSpectator,
    lastPlay,
    playPhase.game_ended_early,
    grouping,
    engine,
  ]);

  const isCurrentPlayerTurn = currentPlayer.id === nextPlayer;
  const canTakeBack =
    lastPlay !== undefined &&
    currentPlayer.id === lastPlay.id &&
    !playPhase.game_ended_early;

  const shouldBeBeeping =
    props.beepOnTurn && isCurrentPlayerTurn && !playPhase.game_ended_early;

  const remainingCardsInHands = ArrayUtils.sum(
    Object.values(playPhase.hands.hands).map((playerHand) =>
      ArrayUtils.sum(Object.values(playerHand)),
    ),
  );

  const { totalPointsPlayed, nonLandlordPointsWithPenalties } = calculatePoints(
    playPhase.propagated.players,
    playPhase.landlords_team,
    playPhase.points,
    playPhase.penalties,
  );

  const noCardsLeft =
    remainingCardsInHands === 0 && playPhase.trick.played_cards.length === 0;

  const canFinish = noCardsLeft || playPhase.game_ended_early;

  const [canEndGameEarly, setCanEndGameEarly] = React.useState(false);

  React.useEffect(() => {
    if (!canFinish && playPhase.decks) {
      engine
        .nextThresholdReachable({
          decks: playPhase.decks,
          params: playPhase.propagated.game_scoring_parameters!,
          non_landlord_points: nonLandlordPointsWithPenalties,
          observed_points: totalPointsPlayed,
        })
        .then((reachable) => {
          setCanEndGameEarly(!reachable);
        })
        .catch((error) => {
          console.error(
            "Error checking if next threshold is reachable:",
            error,
          );
          setCanEndGameEarly(false);
        });
    } else {
      setCanEndGameEarly(false);
    }
  }, [
    canFinish,
    playPhase.decks,
    playPhase.propagated.game_scoring_parameters,
    nonLandlordPointsWithPenalties,
    totalPointsPlayed,
    engine,
  ]);

  const landlordSuffix =
    playPhase.propagated.landlord_emoji !== undefined &&
    playPhase.propagated.landlord_emoji !== null &&
    playPhase.propagated.landlord_emoji !== ""
      ? playPhase.propagated.landlord_emoji
      : "(当庄)";

  const landlordTeamSize = playPhase.landlords_team.length;
  let configFriendTeamSize = 0;
  let smallerTeamSize = false;
  if (playPhase.game_mode !== "Tractor") {
    configFriendTeamSize =
      playPhase.game_mode.FindingFriends.num_friends != null
        ? playPhase.game_mode.FindingFriends.num_friends + 1
        : playPhase.propagated.players.length / 2;
    smallerTeamSize = landlordTeamSize < configFriendTeamSize;
  }

  const getCardsFromHand = (pid: number): SuitGroup[] => {
    const cardsInHand =
      pid in playPhase.hands.hands
        ? Object.entries(playPhase.hands.hands[pid]).flatMap(([c, ct]) =>
            Array(ct).fill(c),
          )
        : [];
    return cardsInHand.length > 0
      ? [
          {
            suit: null as any,
            cards: cardsInHand,
          },
        ]
      : [];
  };

  return (
    <div>
      {shouldBeBeeping ? <Beeper /> : null}
      <Header
        gameMode={playPhase.propagated.game_mode}
        chatLink={playPhase.propagated.chat_link}
      />
      <Players
        players={playPhase.propagated.players}
        observers={playPhase.propagated.observers}
        landlord={playPhase.landlord}
        landlords_team={playPhase.landlords_team}
        name={props.name}
        next={nextPlayer}
      />
      <Trump trump={playPhase.trump} />
      <Friends gameMode={playPhase.game_mode} showPlayed={true} />
      {playPhase.removed_cards!.length > 0 ? (
        <p>
          注意：{" "}
          {playPhase.removed_cards!.map((c) => (
            <InlineCard key={c} card={c} />
          ))}{" "}
          已从牌堆中移除
        </p>
      ) : null}
      {settings.showPointsAboveGame && (
        <ProgressBarDisplay
          points={playPhase.points}
          penalties={playPhase.penalties}
          decks={playPhase.decks!}
          trump={playPhase.trump}
          players={playPhase.propagated.players}
          landlordTeam={playPhase.landlords_team}
          landlord={playPhase.landlord}
          hideLandlordPoints={playPhase.propagated.hide_landlord_points!}
          gameScoringParameters={playPhase.propagated.game_scoring_parameters!}
          smallerTeamSize={smallerTeamSize}
        />
      )}
      <Trick
        trick={playPhase.trick}
        players={playPhase.propagated.players}
        landlord={playPhase.landlord}
        landlord_suffix={landlordSuffix}
        landlords_team={playPhase.landlords_team}
        next={nextPlayer}
        name={props.name}
        showTrickInPlayerOrder={props.showTrickInPlayerOrder}
      />
      <AutoPlayButton
        onSubmit={playCards}
        playDescription={
          grouping.length === 1 && lastPlay === undefined
            ? grouping[0].description
            : null
        }
        canSubmit={canPlay!}
        currentWinner={playPhase.trick.current_winner!}
        unsetAutoPlayWhenWinnerChanges={props.unsetAutoPlayWhenWinnerChanges}
        isCurrentPlayerTurn={isCurrentPlayerTurn}
      />
      {playPhase.propagated.play_takeback_policy === "AllowPlayTakeback" && (
        <button className="big" onClick={takeBackCards} disabled={!canTakeBack}>
          撤回上一次出牌
        </button>
      )}
      <button
        className="big"
        onClick={endTrick}
        disabled={
          playPhase.trick.player_queue.length > 0 || playPhase.game_ended_early
        }
      >
        结束本墩
      </button>
      {canEndGameEarly && (
        <button
          className="big"
          onClick={() => {
            if (
              confirm(
                "确定要提前结束本局吗？底牌中可能仍有分牌。",
              )
            ) {
              endGameEarly();
            }
          }}
        >
          提前结束本局
        </button>
      )}
      {canFinish && (
        <button className="big" onClick={startNewGame}>
          结束本局
        </button>
      )}
      <BeepButton />
      {canFinish && !noCardsLeft && (
        <div>
          <p>未出的剩余手牌：</p>
          {playPhase.propagated.players.map((p) => (
            <LabeledPlay
              key={p.id}
              trump={playPhase.trump}
              label={p.name}
              cards={getCardsFromHand(p.id).flatMap((g) => g.cards)}
            />
          ))}
        </div>
      )}
      {!canFinish && (
        <>
          {playPhase.trick.trick_format !== null &&
          !isSpectator &&
          playPhase.trick.player_queue.includes(currentPlayer.id) ? (
            <TrickFormatHelper
              format={playPhase.trick.trick_format!}
              hands={playPhase.hands}
              playerId={currentPlayer.id}
              trickDrawPolicy={playPhase.propagated.trick_draw_policy!}
              setSelected={(newSelected) => {
                updateSelectionAndGrouping(
                  newSelected,
                  playPhase.trump,
                  playPhase.propagated.tractor_requirements!,
                );
              }}
            />
          ) : null}
          {lastPlay === undefined &&
            isCurrentPlayerTurn &&
            grouping.length > 1 && (
              <div>
                <p>你选择的牌有多种牌型解释。</p>
                <p>请选择你想出的牌型：</p>
                {grouping.map((g, gidx) => (
                  <button
                    key={gidx}
                    onClick={(evt) => {
                      evt.preventDefault();
                      setGrouping([g]);
                    }}
                    className="big"
                  >
                    {g.description}
                  </button>
                ))}
              </div>
            )}
          <Cards
            hands={playPhase.hands}
            playerId={currentPlayer.id}
            trump={playPhase.trump}
            selectedCards={selected}
            onSelect={(newSelected) => {
              updateSelectionAndGrouping(
                newSelected,
                playPhase.trump,
                playPhase.propagated.tractor_requirements!,
              );
            }}
            notifyEmpty={isCurrentPlayerTurn}
          />
        </>
      )}
      {playPhase.last_trick !== undefined &&
      playPhase.last_trick !== null &&
      props.showLastTrick ? (
        <div>
          <p>上一墩</p>
          <Trick
            trick={playPhase.last_trick}
            players={playPhase.propagated.players}
            landlord={playPhase.landlord}
            landlord_suffix={landlordSuffix}
            landlords_team={playPhase.landlords_team}
            name={props.name}
            showTrickInPlayerOrder={props.showTrickInPlayerOrder}
          />
        </div>
      ) : null}
      {playPhase.propagated.game_scoring_parameters ? (
        <Points
          points={playPhase.points}
          penalties={playPhase.penalties}
          decks={playPhase.decks || []}
          players={playPhase.propagated.players}
          landlordTeam={playPhase.landlords_team}
          landlord={playPhase.landlord}
          trump={playPhase.trump}
          hideLandlordPoints={
            playPhase.propagated.hide_landlord_points || false
          }
          gameScoringParameters={playPhase.propagated.game_scoring_parameters}
          smallerTeamSize={smallerTeamSize}
        />
      ) : null}
      <LabeledPlay
        trump={playPhase.trump}
        className="kitty"
        cards={playPhase.kitty}
        label="底牌"
      />
    </div>
  );
};

const HelperContents = (props: {
  format: TrickFormat;
  hands: Hands;
  playerId: number;
  trickDrawPolicy: TrickDrawPolicy;
  setSelected: (selected: string[]) => void;
}): JSX.Element => {
  const engine = useEngine();
  const [decomp, setDecomp] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    engine
      .decomposeTrickFormat({
        trick_format: props.format,
        hands: props.hands,
        player_id: props.playerId,
        trick_draw_policy: props.trickDrawPolicy,
      })
      .then((result) => {
        if (!cancelled) {
          setDecomp(result);
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error("Error decomposing trick format:", error);
        if (!cancelled) {
          setDecomp([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    props.format,
    props.hands,
    props.playerId,
    props.trickDrawPolicy,
    engine,
  ]);

  if (loading) {
    return <div>正在分析牌型……</div>;
  }

  if (props.format.is_rainbow) {
    const rainbows = decomp.filter((d) => d.playable.length > 0);
    return (
      <>
        <p>
          <strong>🌈 彩虹牌型！</strong> 首家出了至少横跨 4 种花色、点数相同的一组牌。
        </p>
        <p>
          如果你有“彩虹”——张数与本墩相同且点数全部相同——则必须出一组彩虹。
        </p>
        <p>
          点数最高的彩虹获胜；如果跟家无人出彩虹，则首家获胜。
        </p>
        {rainbows.length > 0 ? (
          <>
            <p>你可以出：</p>
            <ul>
              {rainbows.map((r, idx) => (
                <li key={idx}>
                  <span
                    style={{ cursor: "pointer" }}
                    onClick={() => props.setSelected(r.playable)}
                  >
                    {r.playable.map((c: string, cidx: number) => (
                      <InlineCard key={cidx} card={c} />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>你没有彩虹牌型，可以任意出牌。</p>
        )}
      </>
    );
  }

  if (decomp.length === 0) {
    return <div>无法分析该牌型</div>;
  }

  const trickSuit = props.format.suit;
  const bestMatch = decomp.findIndex((d) => d.playable.length > 0);
  const modalContents = (
    <>
      <p>
        要争取赢得本墩，你需要在 {trickSuit} 中跟出 {decomp[0].description}。
      </p>
      {decomp[0].playable.length > 0 && (
        <p>
          你可以跟出这个牌型，例如：{" "}
          <span
            style={{ cursor: "pointer" }}
            onClick={() => props.setSelected(decomp[0].playable)}
          >
            {decomp[0].playable.map((c: string, cidx: number) => (
              <InlineCard key={cidx} card={c} />
            ))}
          </span>
        </p>
      )}

      {decomp.length > 1 && props.trickDrawPolicy !== "NoFormatBasedDraw" && (
        <>
          <p>如果不能完全跟出上述牌型，但能跟出以下某种牌型，则必须按顺序尽量跟：</p>
          <ol>
            {decomp.slice(1).map((d, idx) => (
              <li
                key={idx}
                style={{
                  fontWeight: idx === bestMatch - 1 ? "bold" : "normal",
                }}
              >
                {d.description}（{trickSuit}）
                {idx === bestMatch - 1 && (
                  <>
                    {" "}
                    <span
                      style={{ cursor: "pointer" }}
                      onClick={() => props.setSelected(d.playable)}
                    >
                      （例如：{" "}
                      {d.playable.map((c: string, cidx: number) => (
                        <InlineCard key={cidx} card={c} />
                      ))}
                      ）
                    </span>
                  </>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
      <p
        style={{
          fontWeight: bestMatch < 0 ? "bold" : "normal",
        }}
      >
        否则，你必须尽可能把手中的 {trickSuit} 跟完；不足的张数可用其他牌补足。
      </p>
      {trickSuit !== "Trump" && (
        <p>
          如果你没有 {trickSuit}，可以用主牌中的 {decomp[0].description} 尝试赢得本墩。
        </p>
      )}
    </>
  );

  return modalContents;
};

const TrickFormatHelper = (props: {
  format: TrickFormat;
  hands: Hands;
  playerId: number;
  trickDrawPolicy: TrickDrawPolicy;
  setSelected: (selected: string[]) => void;
}): JSX.Element => {
  const engine = useEngine();
  const [modalOpen, setModalOpen] = React.useState<boolean>(false);
  const [message, setMessage] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  React.useEffect(() => {
    setMessage("");
  }, [props.hands]);

  return (
    <>
      <Tooltip id="helpTip" place="top" />
      <button
        data-tooltip-id="helpTip"
        data-tooltip-content="查看当前可以出的牌型"
        className="big"
        onClick={(evt) => {
          evt.preventDefault();
          setModalOpen(true);
        }}
      >
        ?
      </button>
      <Tooltip id="suggestTip" place="top" />
      <button
        data-tooltip-id="suggestTip"
        data-tooltip-content="建议一组可出的牌（不保证最佳）"
        className="big"
        disabled={isLoading}
        onClick={async (evt) => {
          evt.preventDefault();
          setIsLoading(true);
          try {
            const decomp = await engine.decomposeTrickFormat({
              trick_format: props.format,
              hands: props.hands,
              player_id: props.playerId,
              trick_draw_policy: props.trickDrawPolicy,
            });
            const bestMatch = decomp.findIndex((d) => d.playable.length > 0);
            if (bestMatch >= 0) {
              props.setSelected(decomp[bestMatch].playable);
              setMessage("已选择建议牌");
              setTimeout(() => setMessage(""), 500);
            } else {
              setMessage("无法提供出牌建议");
              setTimeout(() => setMessage(""), 2000);
            }
          } catch (error) {
            console.error("Error getting play suggestion:", error);
            setMessage("生成出牌建议时出错");
            setTimeout(() => setMessage(""), 2000);
          } finally {
            setIsLoading(false);
          }
        }}
      >
        {isLoading ? "..." : "✨"}
      </button>
      <span style={{ color: "red" }} onClick={() => setMessage("")}>
        {message}
      </span>
      <ReactModal
        isOpen={modalOpen}
        onRequestClose={() => setModalOpen(false)}
        shouldCloseOnOverlayClick
        shouldCloseOnEsc
        style={{ content: contentStyle }}
      >
        {modalOpen && (
          <HelperContents
            format={props.format}
            hands={props.hands}
            playerId={props.playerId}
            trickDrawPolicy={props.trickDrawPolicy}
            setSelected={(sel) => {
              props.setSelected(sel);
              setModalOpen(false);
            }}
          />
        )}
      </ReactModal>
    </>
  );
};

export default Play;
