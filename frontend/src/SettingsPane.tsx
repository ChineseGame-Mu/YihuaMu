import * as React from "react";
import {
  Settings,
  ISuitOverrides,
  DEFAULT_POINT_CARD_ICON,
  DEFAULT_TRUMP_CARD_ICON,
} from "./state/Settings";
import { CompactPicker } from "react-color";
import styled from "styled-components";

import type { JSX } from "react";

const Picker = React.lazy(async () => await import("emoji-picker-react"));

const Row = styled.div`
  display: table-row;
  line-height: 23px;
`;
const LabelCell = styled.div`
  display: table-cell;
  padding-right: 2em;
`;
const Cell = styled.div`
  display: table-cell;
`;

interface IProps {
  settings: Settings;
  onChangeSettings: (settings: Settings) => void;
}

const SettingsPane = (props: IProps): JSX.Element => {
  const { settings } = props;
  const makeChangeHandler = (partialSettings: Partial<Settings>) => () => {
    const newSettings = { ...props.settings, ...partialSettings };
    props.onChangeSettings(newSettings);
  };

  const [link, setLink] = React.useState<string>("");

  const setChatLink = (event: React.SyntheticEvent): void => {
    event.preventDefault();
    if (link.length > 0) {
      (window as any).send({ Action: { SetChatLink: link } });
    } else {
      (window as any).send({ Action: { SetChatLink: null } });
    }
    setLink("");
  };

  const editor = (
    <div style={{ marginBottom: "15px" }}>
      <input
        type="text"
        style={{ width: "150px" }}
        value={link}
        onChange={(evt) => {
          evt.preventDefault();
          setLink(evt.target.value);
        }}
        placeholder="https://... 语音聊天室链接"
      />
      <input type="button" onClick={setChatLink} value="设置" />
    </div>
  );

  return (
    <div className="settings">
      <div style={{ display: "table" }}>
        <Row>
          <LabelCell>四色牌面模式</LabelCell>
          <Cell>
            <input
              name="four-color-mode"
              type="checkbox"
              checked={settings.fourColor}
              onChange={makeChangeHandler({ fourColor: !settings.fourColor })}
            />
          </Cell>
        </Row>
        <Row>
          <LabelCell>深色模式</LabelCell>
          <Cell>
            <input
              name="dark-mode"
              type="checkbox"
              checked={settings.darkMode}
              onChange={makeChangeHandler({ darkMode: !settings.darkMode })}
            />
          </Cell>
        </Row>
        <Row>
          <LabelCell>使用 SVG 扑克牌</LabelCell>
          <Cell>
            <input
              name="svg-cards"
              type="checkbox"
              checked={settings.svgCards}
              onChange={makeChangeHandler({ svgCards: !settings.svgCards })}
            />
          </Cell>
        </Row>
        <Row>
          <LabelCell>始终显示牌面文字</LabelCell>
          <Cell>
            <input
              name="show-card-labels"
              type="checkbox"
              checked={settings.showCardLabels}
              onChange={makeChangeHandler({
                showCardLabels: !settings.showCardLabels,
              })}
            />
          </Cell>
        </Row>
        <Row>
          <LabelCell>分牌图标</LabelCell>
          <Cell>
            <EmojiPicker
              value={settings.pointCardIcon}
              setEmoji={(emoji) =>
                makeChangeHandler({ pointCardIcon: emoji })()
              }
              setDefault={makeChangeHandler({
                pointCardIcon: DEFAULT_POINT_CARD_ICON,
              })}
            />
          </Cell>
        </Row>
        <Row>
          <LabelCell>主牌图标</LabelCell>
          <Cell>
            <EmojiPicker
              value={settings.trumpCardIcon}
              setEmoji={(emoji) =>
                makeChangeHandler({ trumpCardIcon: emoji })()
              }
              setDefault={makeChangeHandler({
                trumpCardIcon: DEFAULT_TRUMP_CARD_ICON,
              })}
            />
          </Cell>
        </Row>
        <Row>
          <LabelCell>显示上一轮牌</LabelCell>
          <Cell>
            <input
              name="show-last-trick"
              type="checkbox"
              checked={settings.showLastTrick}
              onChange={makeChangeHandler({
                showLastTrick: !settings.showLastTrick,
              })}
            />
          </Cell>
        </Row>
        <Row>
          <LabelCell>轮到我时发出提示音</LabelCell>
          <Cell>
            <input
              name="beep-on-turn"
              type="checkbox"
              checked={settings.beepOnTurn}
              onChange={makeChangeHandler({ beepOnTurn: !settings.beepOnTurn })}
            />
          </Cell>
        </Row>
        <Row>
          <LabelCell>手牌反向排列</LabelCell>
          <Cell>
            <input
              name="reverse-card-order"
              type="checkbox"
              checked={settings.reverseCardOrder}
              onChange={makeChangeHandler({
                reverseCardOrder: !settings.reverseCardOrder,
              })}
            />
          </Cell>
        </Row>
        <Row>
          <LabelCell>按有效花色分开手牌</LabelCell>
          <Cell>
            <input
              name="separate-cards-by-suit"
              type="checkbox"
              checked={settings.separateCardsBySuit}
              onChange={makeChangeHandler({
                separateCardsBySuit: !settings.separateCardsBySuit,
              })}
            />
          </Cell>
        </Row>
        <Row>
          <LabelCell>关闭同花色高亮</LabelCell>
          <Cell>
            <input
              name="disable-suit-highlights"
              type="checkbox"
              checked={settings.disableSuitHighlights}
              onChange={makeChangeHandler({
                disableSuitHighlights: !settings.disableSuitHighlights,
              })}
            />
          </Cell>
        </Row>
        <Row>
          <LabelCell>当前赢家改变时取消自动出牌</LabelCell>
          <Cell>
            <input
              name="unset-auto-play-when-winner-changes"
              type="checkbox"
              checked={settings.unsetAutoPlayWhenWinnerChanges}
              onChange={makeChangeHandler({
                unsetAutoPlayWhenWinnerChanges:
                  !settings.unsetAutoPlayWhenWinnerChanges,
              })}
            />
          </Cell>
        </Row>
        <Row>
          <LabelCell>按玩家顺序显示本轮出牌</LabelCell>
          <Cell>
            <input
              name="show-trick-in-player-order"
              type="checkbox"
              checked={settings.showTrickInPlayerOrder}
              onChange={makeChangeHandler({
                showTrickInPlayerOrder: !settings.showTrickInPlayerOrder,
              })}
            />
          </Cell>
        </Row>
        <Row>
          <LabelCell>自定义花色颜色</LabelCell>
          <Cell>
            {settings.svgCards ? (
              "使用 SVG 扑克牌时不可用"
            ) : (
              <SuitOverrides
                suitColors={settings.suitColorOverrides}
                setSuitColors={(newOverrides: ISuitOverrides) =>
                  props.onChangeSettings({
                    ...props.settings,
                    suitColorOverrides: newOverrides,
                  })
                }
              />
            )}
          </Cell>
        </Row>
        <Row>
          <LabelCell>摸牌时播放声音</LabelCell>
          <Cell>
            <input
              name="play-sound-when-drawing-card"
              type="checkbox"
              checked={settings.playDrawCardSound}
              onChange={makeChangeHandler({
                playDrawCardSound: !settings.playDrawCardSound,
              })}
            />
          </Cell>
        </Row>
        <Row>
          <LabelCell>显示调试信息</LabelCell>
          <Cell>
            <input
              name="show-debug-info"
              type="checkbox"
              checked={settings.showDebugInfo}
              onChange={makeChangeHandler({
                showDebugInfo: !settings.showDebugInfo,
              })}
            />
          </Cell>
        </Row>
        <Row>
          <LabelCell>在浏览器标题栏显示玩家姓名</LabelCell>
          <Cell>
            <input
              name="show-player-name"
              type="checkbox"
              checked={settings.showPlayerName}
              onChange={makeChangeHandler({
                showPlayerName: !settings.showPlayerName,
              })}
            />
          </Cell>
        </Row>
        <Row>
          <LabelCell>隐藏聊天框</LabelCell>
          <Cell>
            <input
              name="hide-chat-box"
              type="checkbox"
              checked={settings.hideChatBox}
              onChange={makeChangeHandler({
                hideChatBox: !settings.hideChatBox,
              })}
            />
          </Cell>
        </Row>
        <Row>
          <LabelCell>把分数进度条显示在牌桌上方</LabelCell>
          <Cell>
            <input
              name="show-points-above-game"
              type="checkbox"
              checked={settings.showPointsAboveGame}
              onChange={makeChangeHandler({
                showPointsAboveGame: !settings.showPointsAboveGame,
              })}
            />
          </Cell>
        </Row>
        <Row>
          <LabelCell>自动摸牌速度</LabelCell>
          <Cell>
            <select
              value={
                settings.autodrawSpeedMs !== null
                  ? settings.autodrawSpeedMs
                  : ""
              }
              onChange={(e) =>
                makeChangeHandler({
                  autodrawSpeedMs: parseInt(e.target.value),
                })()
              }
            >
              <option value="250">默认</option>
              <option value="500">慢</option>
              <option value="10">快</option>
            </select>
          </Cell>
        </Row>
      </div>
      <hr />
      <div style={{ display: "table" }}>
        <Row>
          <LabelCell>聊天室链接</LabelCell>
          <Cell>{editor}</Cell>
        </Row>
      </div>
    </div>
  );
};

const SuitOverrides = (props: {
  suitColors: ISuitOverrides;
  setSuitColors: (overrides: ISuitOverrides) => void;
}): JSX.Element => {
  const suits: Array<keyof ISuitOverrides> = ["♢", "♡", "♤", "♧", "🃟", "🃏"];
  const labels = ["♦", "♥", "♠", "♣", "小王", "大王"];
  return (
    <>
      {suits.map((suit, idx) => (
        <SuitColorPicker
          key={suit}
          suit={suit}
          label={labels[idx]}
          suitColor={props.suitColors[suit]}
          setSuitColor={(color: string) => {
            const n = { ...props.suitColors };
            n[suit] = color;
            props.setSuitColors(n);
          }}
        />
      ))}
      <button
        className="normal"
        onClick={(evt) => {
          evt.preventDefault();
          props.setSuitColors({});
        }}
      >
        恢复默认
      </button>
    </>
  );
};

const SuitColorPicker = (props: {
  suit: string;
  label: string;
  suitColor?: string;
  setSuitColor: (color: string) => void;
}): JSX.Element => {
  const [showPicker, setShowPicker] = React.useState<boolean>(false);
  return (
    <>
      <span
        className={props.suit}
        style={{ color: props.suitColor, cursor: "pointer" }}
        onClick={() => setShowPicker(true)}
      >
        {props.label}
      </span>
      {showPicker ? (
        <div style={{ position: "absolute" }}>
          <div
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={() => setShowPicker(false)}
          />
          <CompactPicker
            color={props.suitColor}
            onChangeComplete={(c: any) => props.setSuitColor(c.hex)}
          />
        </div>
      ) : null}
    </>
  );
};

const EmojiPicker = (props: {
  value: string;
  setEmoji: (emoji: string) => void;
  setDefault: () => void;
}): JSX.Element => {
  const [showPicker, setShowPicker] = React.useState<boolean>(false);
  return (
    <>
      <span>{props.value}</span>
      {!showPicker && (
        <button className="normal" onClick={() => setShowPicker(true)}>
          选择
        </button>
      )}
      {showPicker && (
        <button className="normal" onClick={() => setShowPicker(false)}>
          隐藏
        </button>
      )}
      <button className="normal" onClick={props.setDefault}>
        恢复默认
      </button>
      {props.value !== "" && (
        <button className="normal" onClick={() => props.setEmoji("")}>
          不显示图标
        </button>
      )}
      {showPicker && (
        <React.Suspense fallback={"..."}>
          <Picker onEmojiClick={(emoji) => props.setEmoji(emoji.emoji)} />
        </React.Suspense>
      )}
    </>
  );
};

export default SettingsPane;
