import * as React from "react";
import "./welcome.css";

import type { JSX } from "react";

type GameModeChoice = "Tractor" | "FindingFriends";

type WelcomeProps = {
  connected?: boolean;
  onSelectGameMode?: (mode: GameModeChoice) => void;
};

const Welcome = ({
  connected = false,
  onSelectGameMode,
}: WelcomeProps): JSX.Element => (
  <main className="welcome-page">
    <section className="welcome-card">
      <div className="welcome-suits" aria-hidden="true">
        <span>♠</span>
        <span className="red">♥</span>
        <span className="red">♦</span>
        <span>♣</span>
      </div>

      <p className="welcome-eyebrow">
        在线多人纸牌游戏 · Online Multiplayer Card Game
      </p>
      <h1 className="welcome-title">
        中国纸牌游戏 <span>/ Chinese Card Games</span>
      </h1>
      <p className="welcome-subtitle">
        选择一种玩法，与亲朋好友一起在线游戏。
        <br />
        Choose a game, create a room, and play together anywhere.
      </p>

      <div className="welcome-modes">
        <button
          className="welcome-mode"
          type="button"
          disabled={onSelectGameMode === undefined}
          onClick={() => onSelectGameMode?.("Tractor")}
          style={{
            font: "inherit",
            color: "inherit",
            textAlign: "left",
            cursor: onSelectGameMode === undefined ? "default" : "pointer",
          }}
        >
          <div className="welcome-mode-icon">🃏</div>
          <div>
            <h2>升级 / 拖拉机</h2>
            <p>经典升级玩法，可创建房间与朋友一起在线游戏。</p>
          </div>
        </button>
        <button
          className="welcome-mode"
          type="button"
          disabled={onSelectGameMode === undefined}
          onClick={() => onSelectGameMode?.("FindingFriends")}
          style={{
            font: "inherit",
            color: "inherit",
            textAlign: "left",
            cursor: onSelectGameMode === undefined ? "default" : "pointer",
          }}
        >
          <div className="welcome-mode-icon">🂡</div>
          <div>
            <h2>找朋友</h2>
            <p>保留找朋友玩法，进入游戏后按房间设置开始牌局。</p>
          </div>
        </button>
        <a
          className="welcome-mode"
          href="?game=guandan"
          style={{
            font: "inherit",
            color: "inherit",
            textAlign: "left",
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          <div className="welcome-mode-icon">🂠</div>
          <div>
            <h2>掼蛋 / Guandan</h2>
            <p>四人掼蛋在线版，点击进入后创建或加入掼蛋房间。</p>
          </div>
        </a>
      </div>

      <div className="welcome-actions">
        <a className="welcome-rules-button" href="rules.html">
          查看游戏规则 · Game Rules
        </a>
      </div>

      <div className="welcome-status" role="status" aria-live="polite">
        <span className="welcome-status-dot" />
        {connected
          ? "服务器已连接 · Connected — 请选择游戏模式"
          : "正在连接服务器… 可先选择游戏模式 · Connecting…"}
      </div>
    </section>
  </main>
);

export default Welcome;
