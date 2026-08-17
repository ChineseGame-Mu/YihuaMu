import * as React from "react";
import "./welcome.css";

import type { JSX } from "react";

const Welcome = (): JSX.Element => (
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
        升级 <span>/ Tractor</span>
        <br />
        找朋友 <span>/ Finding Friends</span>
      </h1>
      <p className="welcome-subtitle">
        和亲朋好友一起在线打升级、拖拉机或找朋友。
        <br />
        Create a room, share the link, and play together anywhere.
      </p>

      <div className="welcome-modes">
        <div className="welcome-mode">
          <div className="welcome-mode-icon">🃏</div>
          <div>
            <h2>升级 / 拖拉机</h2>
            <p>经典升级玩法，可创建房间与朋友一起在线游戏。</p>
          </div>
        </div>
        <div className="welcome-mode">
          <div className="welcome-mode-icon">🂡</div>
          <div>
            <h2>找朋友</h2>
            <p>保留找朋友玩法，进入游戏后按房间设置开始牌局。</p>
          </div>
        </div>
      </div>

      <div className="welcome-actions">
        <a className="welcome-rules-button" href="rules.html">
          查看游戏规则 · Game Rules
        </a>
      </div>

      <div className="welcome-status" role="status" aria-live="polite">
        <span className="welcome-status-dot" />
        正在连接服务器… Connecting to the server…
      </div>
    </section>
  </main>
);

export default Welcome;
