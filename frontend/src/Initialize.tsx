import * as React from "react";
import { Tooltip } from "react-tooltip";
import ReactModal from "react-modal";
import { EmojiStyle } from "emoji-picker-react";
import ReadyCheck from "./ReadyCheck";
import LandlordSelector from "./LandlordSelector";
import NumDecksSelector from "./NumDecksSelector";
import KittySizeSelector from "./KittySizeSelector";
import RankSelector from "./RankSelector";
import Kicker from "./Kicker";
import ArrayUtils from "./util/array";
import { RandomizePlayersButton } from "./RandomizePlayersButton";
import {
  CompoundFormats,
  InitializePhase,
  Player,
  PropagatedState,
  Deck,
  TractorRequirements,
} from "./gen-types";
import { WebsocketContext } from "./WebsocketProvider";

import Header from "./Header";
import Players from "./Players";
import { GameScoringSettings } from "./ScoringSettings";

import type { JSX } from "react";

const Picker = React.lazy(async () => await import("emoji-picker-react"));

interface IDifficultyProps {
  state: InitializePhase;
  setFriendSelectionPolicy: (v: React.ChangeEvent<HTMLSelectElement>) => void;
  setMultipleJoinPolicy: (v: React.ChangeEvent<HTMLSelectElement>) => void;
  setAdvancementPolicy: (v: React.ChangeEvent<HTMLSelectElement>) => void;
  setMaxRank: (v: React.ChangeEvent<HTMLSelectElement>) => void;
  setHideLandlordsPoints: (v: React.ChangeEvent<HTMLSelectElement>) => void;
  setHidePlayedCards: (v: React.ChangeEvent<HTMLSelectElement>) => void;
  setKittyPenalty: (v: React.ChangeEvent<HTMLSelectElement>) => void;
  setThrowPenalty: (v: React.ChangeEvent<HTMLSelectElement>) => void;
  setPlayTakebackPolicy: (v: React.ChangeEvent<HTMLSelectElement>) => void;
  setBidTakebackPolicy: (v: React.ChangeEvent<HTMLSelectElement>) => void;
}

const contentStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  width: "80%",
  transform: "translate(-50%, -50%)",
};

const DifficultySettings = (props: IDifficultyProps): JSX.Element => {
  const [modalOpen, setModalOpen] = React.useState<boolean>(false);
  const s = (
    <>
      <div>
        <label>
          找朋友选牌限制：{" "}
          <select
            value={props.state.propagated.friend_selection_policy}
            onChange={props.setFriendSelectionPolicy}
          >
            <option value="Unrestricted">只能选副牌</option>
            <option value="TrumpsIncluded">所有牌，包括主牌</option>
            <option value="HighestCardNotAllowed">
              副牌，但不能选该花色最高牌
            </option>
            <option value="PointCardNotAllowed">
              非主、非分牌（打 A 时 K 除外）
            </option>
          </select>
        </label>
      </div>
      <div>
        <label>
          重复加入庄家方规则：{" "}
          <select
            value={props.state.propagated.multiple_join_policy}
            onChange={props.setMultipleJoinPolicy}
          >
            <option value="Unrestricted">同一玩家可多次加入庄家方</option>
            <option value="NoDoubleJoin">每位玩家最多只能加入庄家方一次</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          升级规则：{" "}
          <select
            value={props.state.propagated.advancement_policy}
            onChange={props.setAdvancementPolicy}
          >
            <option value="Unrestricted">A 必须守住</option>
            <option value="FullyUnrestricted">无限制</option>
            <option value="DefendPoints">分牌（5、10、K）和 A 必须守住</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          最高级别：{" "}
          <select
            value={props.state.propagated.max_rank}
            onChange={props.setMaxRank}
          >
            <option value="NT">无主</option>
            <option value="A">A</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          分数显示：{" "}
          <select
            value={
              props.state.propagated.hide_landlord_points ? "hide" : "show"
            }
            onChange={props.setHideLandlordsPoints}
          >
            <option value="show">显示所有玩家分数</option>
            <option value="hide">隐藏庄家方分数</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          聊天区已出牌显示：{" "}
          <select
            value={props.state.propagated.hide_played_cards ? "hide" : "show"}
            onChange={props.setHidePlayedCards}
          >
            <option value="show">在聊天区显示已出牌</option>
            <option value="hide">在聊天区隐藏已出牌</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          底牌分数惩罚：{" "}
          <select
            value={props.state.propagated.kitty_penalty}
            onChange={props.setKittyPenalty}
          >
            <option value="Times">按最后一墩张数的两倍计算</option>
            <option value="Power">按 2 的“最后一墩张数”次方计算</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          甩牌失败惩罚：{" "}
          <select
            value={props.state.propagated.throw_penalty}
            onChange={props.setThrowPenalty}
          >
            <option value="None">无惩罚</option>
            <option value="TenPointsPerAttempt">每次错误甩牌罚 10 分</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          出牌撤回：{" "}
          <select
            value={props.state.propagated.play_takeback_policy}
            onChange={props.setPlayTakebackPolicy}
          >
            <option value="AllowPlayTakeback">允许撤回出牌</option>
            <option value="NoPlayTakeback">不允许撤回出牌</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          叫主撤回：{" "}
          <select
            value={props.state.propagated.bid_takeback_policy}
            onChange={props.setBidTakebackPolicy}
          >
            <option value="AllowBidTakeback">允许撤回叫主</option>
            <option value="NoBidTakeback">不允许撤回叫主</option>
          </select>
        </label>
      </div>
    </>
  );

  return (
    <div>
      <label>
        难度与限制设置：{" "}
        <button
          className="normal"
          onClick={(evt) => {
            evt.preventDefault();
            setModalOpen(true);
          }}
        >
          打开
        </button>
        <ReactModal
          isOpen={modalOpen}
          onRequestClose={() => setModalOpen(false)}
          shouldCloseOnOverlayClick
          shouldCloseOnEsc
          style={{ content: contentStyle }}
        >
          {s}
        </ReactModal>
      </label>
    </div>
  );
};

interface IDeckSettings {
  decks: Deck[];
  setSpecialDecks: (specialDecks: Deck[]) => void;
}

const DeckSettings = (props: IDeckSettings): JSX.Element => {
  const [modalOpen, setModalOpen] = React.useState<boolean>(false);
  const isNotDefault = (d: Deck): boolean =>
    !(d.min === "2" && !d.exclude_big_joker && !d.exclude_small_joker);
  const onChange = (decks: Deck[]): void => {
    const filtered = decks.filter((d) => isNotDefault(d));
    props.setSpecialDecks(filtered);
  };

  const setDeckAtIndex = (deck: Deck, index: number): void => {
    const newDecks = [...props.decks];
    newDecks[index] = deck;
    onChange(newDecks);
  };
  const numbers = [
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
    "A",
  ];

  const s = (
    <>
      {props.decks.map((d, i) => (
        <div
          key={i}
          style={{
            display: "inline-block",
            border: "1px solid #000",
            padding: "5px",
            margin: "5px",
          }}
        >
          第 {i + 1} 副牌
          {isNotDefault(d) ? "（已修改）" : "（标准）"}
          <form>
            <label style={{ display: "block" }}>
              包含大王{" "}
              <input
                type="checkbox"
                checked={!d.exclude_big_joker}
                onChange={(evt) =>
                  setDeckAtIndex(
                    { ...d, exclude_big_joker: !evt.target.checked },
                    i,
                  )
                }
              />
            </label>
            <label style={{ display: "block" }}>
              包含小王{" "}
              <input
                type="checkbox"
                checked={!d.exclude_small_joker}
                onChange={(evt) =>
                  setDeckAtIndex(
                    { ...d, exclude_small_joker: !evt.target.checked },
                    i,
                  )
                }
              />
            </label>
            <label>
              最小点数：{" "}
              <select
                value={d.min}
                onChange={(evt) =>
                  setDeckAtIndex({ ...d, min: evt.target.value }, i)
                }
              >
                {numbers.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </form>
        </div>
      ))}
    </>
  );

  return (
    <div>
      <label>
        更多牌组自定义：{" "}
        <button
          className="normal"
          onClick={(evt) => {
            evt.preventDefault();
            setModalOpen(true);
          }}
        >
          打开
        </button>
        <ReactModal
          isOpen={modalOpen}
          onRequestClose={() => setModalOpen(false)}
          shouldCloseOnOverlayClick
          shouldCloseOnEsc
          style={{ content: contentStyle }}
        >
          {s}
        </ReactModal>
      </label>
    </div>
  );
};

interface ITractorRequirementsProps {
  tractorRequirements: TractorRequirements;
  numDecks: number;
  onChange: (requirements: TractorRequirements) => void;
}

const TractorRequirementsE = (
  props: ITractorRequirementsProps,
): JSX.Element => {
  return (
    <div>
      <label>拖拉机最低要求：</label>
      <input
        type="number"
        style={{ width: "3em" }}
        onChange={(v) =>
          props.onChange({
            ...props.tractorRequirements,
            min_count: v.target.valueAsNumber,
          })
        }
        value={props.tractorRequirements.min_count}
        min="2"
        max={props.numDecks}
      />
      <label> 张一组 × </label>
      <input
        type="number"
        style={{ width: "3em" }}
        onChange={(v) =>
          props.onChange({
            ...props.tractorRequirements,
            min_length: v.target.valueAsNumber,
          })
        }
        value={props.tractorRequirements.min_length}
        min="2"
        max="12"
      />
      <label> 组连续牌</label>
    </div>
  );
};

interface IScoringSettings {
  state: InitializePhase;
  decks: Deck[];
}
const ScoringSettings = (props: IScoringSettings): JSX.Element => {
  const [modalOpen, setModalOpen] = React.useState<boolean>(false);
  return (
    <div>
      <label>
        计分设置：{" "}
        <button
          className="normal"
          onClick={(evt) => {
            evt.preventDefault();
            setModalOpen(true);
          }}
        >
          打开
        </button>
        <ReactModal
          isOpen={modalOpen}
          onRequestClose={() => setModalOpen(false)}
          shouldCloseOnOverlayClick
          shouldCloseOnEsc
          style={{ content: contentStyle }}
        >
          <GameScoringSettings
            params={props.state.propagated.game_scoring_parameters!}
            decks={props.decks}
          />
        </ReactModal>
      </label>
    </div>
  );
};

interface IUncommonSettings {
  state: InitializePhase;
  numDecksEffective: number;
  setBidPolicy: (v: React.ChangeEvent<HTMLSelectElement>) => void;
  setBidReinforcementPolicy: (v: React.ChangeEvent<HTMLSelectElement>) => void;
  setJokerBidPolicy: (v: React.ChangeEvent<HTMLSelectElement>) => void;
  setShouldRevealKittyAtEndOfGame: (
    v: React.ChangeEvent<HTMLSelectElement>,
  ) => void;
  setFirstLandlordSelectionPolicy: (
    v: React.ChangeEvent<HTMLSelectElement>,
  ) => void;
  setGameStartPolicy: (v: React.ChangeEvent<HTMLSelectElement>) => void;
  setGameShadowingPolicy: (v: React.ChangeEvent<HTMLSelectElement>) => void;
  setKittyBidPolicy: (v: React.ChangeEvent<HTMLSelectElement>) => void;
  setJackVariation: (v: React.ChangeEvent<HTMLSelectElement>) => void;
  setHideThrowHaltingPlayer: (v: React.ChangeEvent<HTMLSelectElement>) => void;
  setTractorRequirements: (v: TractorRequirements) => void;
  setBombPolicy: (v: React.ChangeEvent<HTMLSelectElement>) => void;
  setCompoundFormats: (v: CompoundFormats) => void;
}

const UncommonSettings = (props: IUncommonSettings): JSX.Element => {
  const [modalOpen, setModalOpen] = React.useState<boolean>(false);
  const s = (
    <>
      <div>
        <label>
          同名玩家旁观/接管规则：{" "}
          <select
            value={props.state.propagated.game_shadowing_policy}
            onChange={props.setGameShadowingPolicy}
          >
            <option value="AllowMultipleSessions">
              允许用相同名字加入并旁观/接管同一玩家
            </option>
            <option value="SingleSessionOnly">不允许同名玩家重复加入</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          开局权限：{" "}
          <select
            value={props.state.propagated.game_start_policy}
            onChange={props.setGameStartPolicy}
          >
            <option value="AllowAnyPlayer">任何玩家都可开始游戏</option>
            <option value="AllowLandlordOnly">只有庄家可以开始游戏</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          首局庄家确定方式：{" "}
          <select
            value={props.state.propagated.first_landlord_selection_policy}
            onChange={props.setFirstLandlordSelectionPolicy}
          >
            <option value="ByWinningBid">最终叫主者同时决定庄家和主牌</option>
            <option value="ByFirstBid">
              第一个叫主者成为庄家，最终叫主决定主牌
            </option>
          </select>
        </label>
      </div>
      <div>
        <label>
          翻底牌定主规则：{" "}
          <select
            value={props.state.propagated.kitty_bid_policy}
            onChange={props.setKittyBidPolicy}
          >
            <option value="FirstCard">以第一张翻出的牌为准</option>
            <option value="FirstCardOfLevelOrHighest">
              以第一张符合当前级别的牌为准
            </option>
          </select>
        </label>
      </div>
      <div>
        <label>
          叫主压制规则：{" "}
          <select
            value={props.state.propagated.bid_policy}
            onChange={props.setBidPolicy}
          >
            <option value="JokerOrHigherSuit">
              同张数时，大王/小王或更高花色可压过普通叫主
            </option>
            <option value="JokerOrGreaterLength">
              同张数时只有王可以压普通叫主，否则必须增加张数
            </option>
            <option value="GreaterLength">
              每次叫主都必须比前一次使用更多张牌
            </option>
          </select>
        </label>
      </div>
      <div>
        <label>
          加固叫主规则：{" "}
          <select
            value={props.state.propagated.bid_reinforcement_policy}
            onChange={props.setBidReinforcementPolicy}
          >
            <option value="ReinforceWhileWinning">
              当前领先的叫主可以继续加固
            </option>
            <option value="ReinforceWhileEquivalent">
              被反压后仍可用同类牌加固
            </option>
            <option value="OverturnOrReinforceWhileWinning">
              当前领先者可以用自己的更强叫主替换原叫主
            </option>
          </select>
        </label>
      </div>
      <div>
        <label>
          王叫无主规则：{" "}
          <select
            value={props.state.propagated.joker_bid_policy}
            onChange={props.setJokerBidPolicy}
          >
            <option value="BothTwoOrMore">
              至少两张王（或达到副牌数）可叫无主
            </option>
            <option value="BothNumDecks">
              集齐全部小王或全部大王才能叫无主
            </option>
            <option value="LJNumDecksHJNumDecksLessOne">
              集齐全部小王，或除一张外的全部大王，可叫无主
            </option>
            <option value="Disabled">禁用无主/王叫主</option>
          </select>
        </label>
      </div>
      <TractorRequirementsE
        tractorRequirements={props.state.propagated.tractor_requirements!}
        numDecks={props.numDecksEffective}
        onChange={(req) => props.setTractorRequirements(req)}
      />
      {props.numDecksEffective >= 4 && (
        <div>
          <label>
            炸弹（4 张或以上完全相同的牌可压同张数牌型）：{" "}
            <select
              value={props.state.propagated.bomb_policy ?? "NoBombs"}
              onChange={props.setBombPolicy}
            >
              <option value="NoBombs">关闭</option>
              <option value="AllowBombs">开启（任何花色，不要求跟花色）</option>
              <option value="AllowBombsSuitFollowing">
                开启（仍必须跟花色）
              </option>
            </select>
          </label>
        </div>
      )}
      <div>
        <label>
          彩虹牌型（同点数、横跨至少 4 种花色）：{" "}
          <select
            value={
              props.state.propagated.compound_formats?.rainbows != null
                ? "enabled"
                : "disabled"
            }
            onChange={(evt) => {
              if (evt.target.value === "enabled") {
                props.setCompoundFormats({
                  rainbows:
                    props.state.propagated.compound_formats?.rainbows ??
                    (props.state.propagated.num_decks ?? 2) * 2 + 1,
                });
              } else {
                props.setCompoundFormats({ rainbows: null });
              }
            }}
          >
            <option value="disabled">关闭</option>
            <option value="enabled">开启</option>
          </select>
        </label>
        {props.state.propagated.compound_formats?.rainbows != null && (
          <label>
            {" "}
            最少张数：{" "}
            <input
              type="number"
              min={4}
              value={props.state.propagated.compound_formats.rainbows}
              onChange={(evt) => {
                const n = parseInt(evt.target.value, 10);
                if (!isNaN(n) && n >= 4) {
                  props.setCompoundFormats({ rainbows: n });
                }
              }}
            />
          </label>
        )}
      </div>
      <div>
        <label>
          本局结束时公开底牌：{" "}
          <select
            value={
              props.state.propagated.should_reveal_kitty_at_end_of_game
                ? "show"
                : "hide"
            }
            onChange={props.setShouldRevealKittyAtEndOfGame}
          >
            <option value="hide">结束时不在聊天区公开底牌</option>
            <option value="show">结束时在聊天区公开底牌</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          显示阻止甩牌的玩家：{" "}
          <select
            value={
              props.state.propagated.hide_throw_halting_player ? "hide" : "show"
            }
            onChange={props.setHideThrowHaltingPlayer}
          >
            <option value="hide">隐藏阻止甩牌的玩家</option>
            <option value="show">显示阻止甩牌的玩家</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          J 特殊规则：{" "}
          <select
            value={props.state.propagated.jack_variation}
            onChange={props.setJackVariation}
          >
            <option value="SingleJack">
              最后一墩用单张 J 获胜时，首家所在队伍降/定到 2 级
            </option>
            <option value="Disabled">关闭 J 特殊规则</option>
          </select>
        </label>
      </div>
    </>
  );
  return (
    <div>
      <label>
        更多游戏设置：{" "}
        <button
          className="normal"
          onClick={(evt) => {
            evt.preventDefault();
            setModalOpen(true);
          }}
        >
          打开
        </button>
        <ReactModal
          isOpen={modalOpen}
          onRequestClose={() => setModalOpen(false)}
          shouldCloseOnOverlayClick
          shouldCloseOnEsc
          style={{ content: contentStyle }}
        >
          {s}
        </ReactModal>
      </label>
    </div>
  );
};

interface IProps {
  state: InitializePhase;
  name: string;
}

const Initialize = (props: IProps): JSX.Element => {
  const { send } = React.useContext(WebsocketContext);
  const [showPicker, setShowPicker] = React.useState<boolean>(false);
  const setGameMode = (evt: React.ChangeEvent<HTMLSelectElement>): void => {
    evt.preventDefault();
    if (evt.target.value === "Tractor") {
      send({ Action: { SetGameMode: "Tractor" } });
    } else {
      send({
        Action: {
          SetGameMode: {
            FindingFriends: {
              num_friends: null,
            },
          },
        },
      });
    }
  };

  const setNumFriends = (evt: React.ChangeEvent<HTMLSelectElement>): void => {
    evt.preventDefault();
    if (evt.target.value === "") {
      send({
        Action: {
          SetGameMode: {
            FindingFriends: {
              num_friends: null,
            },
          },
        },
      });
    } else {
      const num = parseInt(evt.target.value, 10);
      send({
        Action: {
          SetGameMode: {
            FindingFriends: {
              num_friends: num,
            },
          },
        },
      });
    }
  };

  const onSelectString =
    (action: string): ((evt: React.ChangeEvent<HTMLSelectElement>) => void) =>
    (evt: React.ChangeEvent<HTMLSelectElement>): void => {
      evt.preventDefault();
      if (evt.target.value !== "") {
        send({ Action: { [action]: evt.target.value } });
      }
    };

  const onSelectStringDefault =
    (
      action: string,
      defaultValue: null | string,
    ): ((evt: React.ChangeEvent<HTMLSelectElement>) => void) =>
    (evt: React.ChangeEvent<HTMLSelectElement>): void => {
      evt.preventDefault();
      if (evt.target.value !== "") {
        send({ Action: { [action]: evt.target.value } });
      } else {
        send({ Action: { [action]: defaultValue } });
      }
    };

  const setFriendSelectionPolicy = onSelectString("SetFriendSelectionPolicy");
  const setMultipleJoinPolicy = onSelectString("SetMultipleJoinPolicy");
  const setFirstLandlordSelectionPolicy = onSelectString(
    "SetFirstLandlordSelectionPolicy",
  );
  const setBidPolicy = onSelectString("SetBidPolicy");
  const setBidReinforcementPolicy = onSelectString("SetBidReinforcementPolicy");
  const setJokerBidPolicy = onSelectString("SetJokerBidPolicy");
  const setKittyTheftPolicy = onSelectString("SetKittyTheftPolicy");
  const setKittyBidPolicy = onSelectString("SetKittyBidPolicy");
  const setTrickDrawPolicy = onSelectString("SetTrickDrawPolicy");
  const setThrowEvaluationPolicy = onSelectString("SetThrowEvaluationPolicy");
  const setPlayTakebackPolicy = onSelectString("SetPlayTakebackPolicy");
  const setGameShadowingPolicy = onSelectString("SetGameShadowingPolicy");
  const setGameStartPolicy = onSelectString("SetGameStartPolicy");
  const setBidTakebackPolicy = onSelectString("SetBidTakebackPolicy");
  const setGameVisibility = onSelectString("SetGameVisibility");

  const setShouldRevealKittyAtEndOfGame = (
    evt: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    evt.preventDefault();
    if (evt.target.value !== "") {
      send({
        Action: {
          SetShouldRevealKittyAtEndOfGame: evt.target.value === "show",
        },
      });
    }
  };
  const setHideThrowHaltingPlayer = (
    evt: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    evt.preventDefault();
    if (evt.target.value !== "") {
      send({
        Action: {
          SetHideThrowHaltingPlayer: evt.target.value === "hide",
        },
      });
    }
  };
  const setJackVariation = (
    evt: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    evt.preventDefault();
    if (evt.target.value !== "") {
      send({
        Action: {
          SetJackVariation: evt.target.value,
        },
      });
    }
  };
  const setBombPolicy = onSelectString("SetBombPolicy");

  const setKittyPenalty = onSelectStringDefault("SetKittyPenalty", null);
  const setAdvancementPolicy = onSelectStringDefault(
    "SetAdvancementPolicy",
    "Unrestricted",
  );
  const setMaxRank = onSelectStringDefault("SetMaxRank", "NT");
  const setThrowPenalty = onSelectStringDefault("SetThrowPenalty", null);

  const setHideLandlordsPoints = (
    evt: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    evt.preventDefault();
    send({ Action: { SetHideLandlordsPoints: evt.target.value === "hide" } });
  };

  const setHidePlayedCards = (
    evt: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    evt.preventDefault();
    send({ Action: { SetHidePlayedCards: evt.target.value === "hide" } });
  };

  const cleanRoomUrl = (): string => {
    const url = new URL(window.location.href);
    url.search = "";
    return url.toString();
  };

  const startGame = (evt: React.SyntheticEvent): void => {
    evt.preventDefault();
    send({ Action: "StartGame" });
  };

  const setEmoji = (emoji: string): void => {
    send({
      Action: {
        SetLandlordEmoji: emoji,
      },
    });
  };

  const modeAsString =
    props.state.propagated.game_mode === "Tractor"
      ? "Tractor"
      : "FindingFriends";
  const numFriends =
    props.state.propagated.game_mode === "Tractor" ||
    props.state.propagated.game_mode.FindingFriends.num_friends === null
      ? ""
      : props.state.propagated.game_mode.FindingFriends.num_friends;
  const decksEffective =
    props.state.propagated.num_decks !== undefined &&
    props.state.propagated.num_decks !== null &&
    props.state.propagated.num_decks > 0
      ? props.state.propagated.num_decks
      : Math.max(Math.floor(props.state.propagated.players.length / 2), 1);
  const decks = [...(props.state.propagated.special_decks || [])];
  while (decks.length < decksEffective) {
    decks.push({
      exclude_big_joker: false,
      exclude_small_joker: false,
      min: "2",
    });
  }
  decks.length = decksEffective;

  let currentPlayer = props.state.propagated.players.find(
    (p: Player) => p.name === props.name,
  );
  if (currentPlayer === undefined) {
    currentPlayer = props.state.propagated.observers.find(
      (p) => p.name === props.name,
    );
  }
  if (currentPlayer === undefined) {
    currentPlayer = {
      id: -1,
      name: props.name,
      level: "",
      metalevel: 0,
    };
  }

  const landlordIndex = props.state.propagated.players.findIndex(
    (p: Player) => p.id === props.state.propagated.landlord,
  );
  const saveGameSettings = (evt: React.SyntheticEvent): void => {
    evt.preventDefault();
    localStorage.setItem(
      "gameSettingsInLocalStorage",
      JSON.stringify(props.state.propagated),
    );
  };

  const setGameSettings = (gameSettings: PropagatedState): void => {
    if (gameSettings !== null) {
      let kittySizeSet = false;
      let kittySize = null;
      for (const [key, value] of Object.entries(gameSettings)) {
        switch (key) {
          case "game_mode":
            send({ Action: { SetGameMode: value } });
            break;
          case "num_decks":
            send({ Action: { SetNumDecks: value } });
            if (kittySizeSet) {
              send({ Action: { SetKittySize: kittySize } });
            }
            break;
          case "special_decks":
            send({ Action: { SetSpecialDecks: value } });
            break;
          case "kitty_size":
            send({ Action: { SetKittySize: value } });
            kittySizeSet = true;
            kittySize = value;
            break;
          case "friend_selection_policy":
            send({ Action: { SetFriendSelectionPolicy: value } });
            break;
          case "multiple_join_policy":
            send({ Action: { SetMultipleJoinPolicy: value } });
            break;
          case "first_landlord_selection_policy":
            send({ Action: { SetFirstLandlordSelectionPolicy: value } });
            break;
          case "hide_landlord_points":
            send({ Action: { SetHideLandlordsPoints: value } });
            break;
          case "hide_played_cards":
            send({ Action: { SetHidePlayedCards: value } });
            break;
          case "advancement_policy":
            send({ Action: { SetAdvancementPolicy: value } });
            break;
          case "max_rank":
            send({ Action: { SetMaxRank: value } });
            break;
          case "kitty_bid_policy":
            send({ Action: { SetKittyBidPolicy: value } });
            break;
          case "kitty_penalty":
            send({ Action: { SetKittyPenalty: value } });
            break;
          case "kitty_theft_policy":
            send({ Action: { SetKittyTheftPolicy: value } });
            break;
          case "throw_penalty":
            send({ Action: { SetThrowPenalty: value } });
            break;
          case "trick_draw_policy":
            send({ Action: { SetTrickDrawPolicy: value } });
            break;
          case "throw_evaluation_policy":
            send({ Action: { SetThrowEvaluationPolicy: value } });
            break;
          case "landlord_emoji":
            send({ Action: { SetLandlordEmoji: value } });
            break;
          case "bid_policy":
            send({ Action: { SetBidPolicy: value } });
            break;
          case "bid_reinforcement_policy":
            send({ Action: { SetBidReinforcementPolicy: value } });
            break;
          case "joker_bid_policy":
            send({ Action: { SetJokerBidPolicy: value } });
            break;
          case "should_reveal_kitty_at_end_of_game":
            send({ Action: { SetShouldRevealKittyAtEndOfGame: value } });
            break;
          case "hide_throw_halting_player":
            send({ Action: { SetHideThrowHaltingPlayer: value } });
            break;
          case "set_jack_variation":
            send({ Action: { SetJackVariation: value } });
            break;
          case "game_scoring_parameters":
            send({ Action: { SetGameScoringParameters: value } });
            break;
          case "play_takeback_policy":
            send({ Action: { SetPlayTakebackPolicy: value } });
            break;
          case "bid_takeback_policy":
            send({ Action: { SetBidTakebackPolicy: value } });
            break;
          case "game_shadowing_policy":
            send({ Action: { SetGameShadowingPolicy: value } });
            break;
          case "game_start_policy":
            send({ Action: { SetGameStartPolicy: value } });
            break;
          case "tractor_requirements":
            send({ Action: { SetTractorRequirements: value } });
            break;
          case "game_visibility":
            send({ Action: { SetGameVisibility: value } });
            break;
          case "compound_formats":
            send({ Action: { SetCompoundFormats: value } });
            break;
        }
      }
    }
  };

  const loadGameSettings = (evt: React.SyntheticEvent): void => {
    evt.preventDefault();
    const settings = localStorage.getItem("gameSettingsInLocalStorage");
    if (settings !== null) {
      let gameSettings: PropagatedState;
      try {
        gameSettings = JSON.parse(settings);

        const fetchAsync = async (): Promise<void> => {
          const fetchResult = await fetch("default_settings.json");
          const fetchJSON = await fetchResult.json();
          const combined = { ...fetchJSON, ...gameSettings };
          if (
            combined.bonus_level_policy !== undefined &&
            combined.game_scoring_parameters !== undefined &&
            combined.bonus_level_policy !==
              combined.game_scoring_parameters.bonus_level_policy
          ) {
            combined.game_scoring_parameters.bonus_level_policy =
              combined.bonus_level_policy;
          }
          setGameSettings(combined);
        };

        fetchAsync().catch((e) => {
          console.error(e);
          localStorage.setItem(
            "gameSettingsInLocalStorage",
            JSON.stringify(props.state.propagated),
          );
        });
      } catch {
        localStorage.setItem(
          "gameSettingsInLocalStorage",
          JSON.stringify(props.state.propagated),
        );
      }
    }
  };

  const resetGameSettings = (evt: React.SyntheticEvent): void => {
    evt.preventDefault();

    const fetchAsync = async (): Promise<void> => {
      const fetchResult = await fetch("default_settings.json");
      const fetchJSON = await fetchResult.json();
      setGameSettings(fetchJSON);
    };

    fetchAsync().catch((e) => console.error(e));
  };

  return (
    <div>
      <Header
        gameMode={props.state.propagated.game_mode}
        chatLink={props.state.propagated.chat_link}
      />
      <Players
        players={props.state.propagated.players}
        observers={props.state.propagated.observers}
        landlord={props.state.propagated.landlord}
        next={null}
        movable={true}
        name={props.name}
      />
      <p>
        把下面的链接发给其他玩家，让他们加入本局：{" "}
        <a href={cleanRoomUrl()} target="_blank" rel="noreferrer">
          <code>{cleanRoomUrl()}</code>
        </a>
      </p>
      {props.state.propagated.players.length >= 4 ? (
        <>
          <button
            className="big"
            disabled={
              props.state.propagated.game_start_policy ===
                "AllowLandlordOnly" &&
              landlordIndex !== -1 &&
              props.state.propagated.players[landlordIndex].name !== props.name
            }
            onClick={startGame}
          >
            开始游戏
          </button>
          <ReadyCheck />
        </>
      ) : (
        <h2>等待其他玩家加入……</h2>
      )}
      <RandomizePlayersButton players={props.state.propagated.players}>
        随机排列玩家顺序
      </RandomizePlayersButton>
      <Kicker
        players={props.state.propagated.players}
        onKick={(playerId: number) => send({ Kick: playerId })}
      />
      <div className="game-settings">
        <h3>游戏设置</h3>
        <div>
          <label>
            游戏模式：{" "}
            <select value={modeAsString} onChange={setGameMode}>
              <option value="Tractor">升级</option>
              <option value="FindingFriends">找朋友</option>
            </select>
          </label>
        </div>
        <div>
          {props.state.propagated.game_mode !== "Tractor" ? (
            <label>
              朋友人数：{" "}
              <select value={numFriends} onChange={setNumFriends}>
                <option value="">默认</option>
                {ArrayUtils.range(
                  Math.max(
                    Math.floor(props.state.propagated.players.length / 2) - 1,
                    0,
                  ),
                  (idx) => (
                    <option value={idx + 1} key={idx}>
                      {idx + 1}
                    </option>
                  ),
                )}
              </select>
            </label>
          ) : null}
        </div>
        <NumDecksSelector
          numPlayers={props.state.propagated.players.length}
          numDecks={props.state.propagated.num_decks}
          onChange={(newNumDecks: number | null) =>
            send({ Action: { SetNumDecks: newNumDecks } })
          }
        />
        <DeckSettings
          decks={decks}
          setSpecialDecks={(d) => send({ Action: { SetSpecialDecks: d } })}
        />
        <KittySizeSelector
          numPlayers={props.state.propagated.players.length}
          decks={decks}
          kittySize={props.state.propagated.kitty_size}
          onChange={(newKittySize: number | null) =>
            send({ Action: { SetKittySize: newKittySize } })
          }
        />
        <div>
          <label>
            埋底后允许继续反主（炒地皮）：{" "}
            <select
              value={props.state.propagated.kitty_theft_policy}
              onChange={setKittyTheftPolicy}
            >
              <option value="AllowKittyTheft">允许</option>
              <option value="NoKittyTheft">不允许</option>
            </select>
          </label>
        </div>
        <div>
          <label>
            跟牌牌型保护：{" "}
            <select
              value={props.state.propagated.trick_draw_policy}
              onChange={setTrickDrawPolicy}
            >
              <option value="NoProtections">无保护</option>
              <option value="LongerTuplesProtected">
                多张相同牌受保护（例如三张不被对子拆）
              </option>
              <option value="OnlyDrawTractorOnTractor">
                只有拖拉机才能要求跟拖拉机
              </option>
              <option value="LongerTuplesProtectedAndOnlyDrawTractorOnTractor">
                多张相同牌受保护，并且只有拖拉机才能要求跟拖拉机
              </option>
              <option value="NoFormatBasedDraw">
                不按牌型强制跟牌（对子不要求跟对子）
              </option>
            </select>
          </label>
        </div>
        <div>
          <label>
            多组甩牌比较规则：{" "}
            <select
              value={props.state.propagated.throw_evaluation_policy}
              onChange={setThrowEvaluationPolicy}
            >
              <option value="All">跟家必须压过所有组成部分才算赢</option>
              <option value="Highest">跟家只需压过最高的一组</option>
              <option value="TrickUnitLength">
                跟家必须压过张数最多的组成部分
              </option>
            </select>
          </label>
        </div>
        <ScoringSettings state={props.state} decks={decks} />
        <UncommonSettings
          state={props.state}
          numDecksEffective={decksEffective}
          setBidPolicy={setBidPolicy}
          setBidReinforcementPolicy={setBidReinforcementPolicy}
          setJokerBidPolicy={setJokerBidPolicy}
          setShouldRevealKittyAtEndOfGame={setShouldRevealKittyAtEndOfGame}
          setHideThrowHaltingPlayer={setHideThrowHaltingPlayer}
          setFirstLandlordSelectionPolicy={setFirstLandlordSelectionPolicy}
          setGameStartPolicy={setGameStartPolicy}
          setGameShadowingPolicy={setGameShadowingPolicy}
          setKittyBidPolicy={setKittyBidPolicy}
          setJackVariation={setJackVariation}
          setTractorRequirements={(requirements) =>
            send({ Action: { SetTractorRequirements: requirements } })
          }
          setBombPolicy={setBombPolicy}
          setCompoundFormats={(formats) =>
            send({ Action: { SetCompoundFormats: formats } })
          }
        />
        <DifficultySettings
          state={props.state}
          setFriendSelectionPolicy={setFriendSelectionPolicy}
          setMultipleJoinPolicy={setMultipleJoinPolicy}
          setAdvancementPolicy={setAdvancementPolicy}
          setMaxRank={setMaxRank}
          setHideLandlordsPoints={setHideLandlordsPoints}
          setHidePlayedCards={setHidePlayedCards}
          setKittyPenalty={setKittyPenalty}
          setThrowPenalty={setThrowPenalty}
          setPlayTakebackPolicy={setPlayTakebackPolicy}
          setBidTakebackPolicy={setBidTakebackPolicy}
        />
        <div>
          <label>
            房间可见性：{" "}
            <select
              value={props.state.propagated.game_visibility}
              onChange={setGameVisibility}
            >
              <option value={"Unlisted"}>不公开列出</option>
              <option value={"Public"}>公开房间</option>
            </select>
          </label>
        </div>
        <h3>续局设置</h3>
        <LandlordSelector
          players={props.state.propagated.players}
          landlordId={props.state.propagated.landlord}
          onChange={(newLandlord: number | null) =>
            send({ Action: { SetLandlord: newLandlord } })
          }
        />
        <RankSelector
          rank={currentPlayer.level}
          metaRank={currentPlayer.metalevel}
          onChangeRank={(newRank: string) =>
            send({ Action: { SetRank: newRank } })
          }
          onChangeMetaRank={(newMetaRank: number) =>
            send({ Action: { SetMetaRank: newMetaRank } })
          }
        />
        <h3>其他设置</h3>
        <div>
          <label>
            庄家标记：{" "}
            {props.state.propagated.landlord_emoji !== null &&
            props.state.propagated.landlord_emoji !== undefined &&
            props.state.propagated.landlord_emoji !== ""
              ? props.state.propagated.landlord_emoji
              : "当庄"}{" "}
            <button
              className="normal"
              onClick={() => {
                setShowPicker(!showPicker);
              }}
            >
              {showPicker ? "隐藏" : "选择"}
            </button>
            <button
              className="normal"
              disabled={props.state.propagated.landlord_emoji == null}
              onClick={() => {
                send({ Action: { SetLandlordEmoji: null } });
              }}
            >
              默认
            </button>
            {showPicker ? (
              <React.Suspense fallback={"..."}>
                <Picker
                  onEmojiClick={(ecd) => setEmoji(ecd.emoji)}
                  emojiStyle={EmojiStyle.NATIVE}
                />
              </React.Suspense>
            ) : null}
          </label>
        </div>
        <div>
          <label>
            设置管理：
            <button
              className="normal"
              data-tooltip-id="saveTip"
              data-tooltip-content="保存当前游戏设置"
              onClick={saveGameSettings}
            >
              保存
            </button>
            <Tooltip id="saveTip" place="top" />
            <button
              className="normal"
              data-tooltip-id="loadTip"
              data-tooltip-content={"载入已保存的游戏设置"}
              onClick={loadGameSettings}
            >
              载入
            </button>
            <Tooltip id="loadTip" place="top" />
            <button
              className="normal"
              data-tooltip-id="resetTip"
              data-tooltip-content="恢复默认游戏设置"
              data-ti="resetTip"
              onClick={resetGameSettings}
            >
              恢复默认
            </button>
            <Tooltip id="resetTip" place="top" />
          </label>
        </div>
      </div>
    </div>
  );
};

export default Initialize;
