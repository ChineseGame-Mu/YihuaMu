import * as React from "react";
import ReactModal from "react-modal";
import { AppStateContext } from "./AppStateProvider";

import type { JSX } from "react";

const contentStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  width: "min(88vw, 520px)",
  maxHeight: "80vh",
  overflowY: "auto",
  transform: "translate(-50%, -50%)",
};

const changeLogVersion = 25;

const ChangeLog = (): JSX.Element => {
  const [modalOpen, setModalOpen] = React.useState<boolean>(false);
  const { state, updateState } = React.useContext(AppStateContext);

  React.useEffect(() => {
    if (state.changeLogLastViewed !== changeLogVersion) {
      setModalOpen(true);
    }
  }, [state.changeLogLastViewed]);

  const closeModal = (): void => {
    setModalOpen(false);
    updateState({ changeLogLastViewed: changeLogVersion });
  };

  return (
    <>
      <button
        className="normal"
        onClick={(evt) => {
          evt.preventDefault();
          setModalOpen(true);
        }}
      >
        新玩家须知 / 更新记录
      </button>
      <ReactModal
        isOpen={modalOpen}
        onRequestClose={closeModal}
        shouldCloseOnOverlayClick
        shouldCloseOnEsc
        style={{ content: contentStyle }}
      >
        <div style={{ textAlign: "right" }}>
          <button className="normal" onClick={closeModal} aria-label="关闭">
            × 关闭
          </button>
        </div>

        <h2>新玩家须知</h2>
        <p>
          如果您还不熟悉升级玩法，建议先阅读{" "}
          <a href="rules.html" target="_blank" rel="noreferrer">
            游戏规则
          </a>
          。
        </p>
        <p>
          本游戏支持多种常见玩法设置，例如牌副数、计分方式、叫主规则、甩牌规则等；每局开始前都可以调整。
        </p>
        <p>
          进入游戏后，还可以通过页面顶部的设置按钮调整个人界面，例如牌面显示、声音、聊天区和其他显示选项。
        </p>
        <p>
          把房间链接发送给其他玩家；至少 4
          名正式玩家进入同一房间后，才会出现“开始游戏”按钮。
        </p>

        <h2>更新记录</h2>
        <p>2026/8/16：</p>
        <ul>
          <li>建立 YihuaMu 独立版本。</li>
          <li>主要游戏界面改为简体中文。</li>
          <li>
            3–8 副牌启用 YihuaMu 特殊跟牌规则：首家出 4
            张同花色组合或相应拖拉机时，跟家只有 3
            张该花色且其中有一对，不再强制必须把该对子跟出。
          </li>
          <li>恢复原版加入房间页面以及“新玩家须知 / 更新记录”弹窗。</li>
          <li>保持至少 4 名玩家才能开始游戏。</li>
        </ul>
        <p>2026/3/18（原版）：</p>
        <ul>
          <li>
            原版加入 4
            副及以上牌局的炸弹牌支持；相关功能可在更多游戏设置中配置。
          </li>
        </ul>
      </ReactModal>
    </>
  );
};

const Credits = (): JSX.Element => (
  <div style={{ padding: "0 20px" }}>
    <p>Yihua modified</p>
    <ChangeLog />
  </div>
);

export default Credits;
