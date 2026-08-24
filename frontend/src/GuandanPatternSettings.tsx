import * as React from "react";
import { createPortal } from "react-dom";

const GuandanPatternSettings: React.FunctionComponent = () => {
  const [settingsTarget, setSettingsTarget] = React.useState<HTMLElement | null>(
    null,
  );

  React.useEffect(() => {
    const refreshTarget = () => {
      setSettingsTarget(
        document.querySelector<HTMLElement>(".guandan-settings"),
      );
    };

    refreshTarget();
    const observer = new MutationObserver(refreshTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (settingsTarget === null) return null;

  return createPortal(
    <details className="guandan-pattern-settings">
      <summary>牌型提示</summary>
      <div className="guandan-pattern-settings-grid">
        <span>单牌</span>
        <span>对子</span>
        <span>三张</span>
        <span>三带二</span>
        <span>顺子</span>
        <span>连对</span>
        <span>钢板</span>
        <span>同花顺</span>
        <span>炸弹</span>
        <span>四王炸</span>
      </div>
      <p>
        牌型提示仅作规则参考，不改变实际出牌判定。红桃级牌仍按当前掼蛋规则作为百搭牌处理。
      </p>
      <style>{`
        .guandan-pattern-settings {
          margin-top: 14px;
          padding: 10px 12px;
          border: 2px solid #d5ad45;
          border-radius: 12px;
          background: #fff8dc;
          color: #53380b;
        }
        .guandan-pattern-settings > summary {
          cursor: pointer;
          font-weight: 900;
          font-size: 1rem;
        }
        .guandan-pattern-settings-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px 14px;
          margin-top: 10px;
          font-weight: 750;
        }
        .guandan-pattern-settings p {
          margin: 10px 0 0;
          font-size: .84rem;
          line-height: 1.45;
        }
      `}</style>
    </details>,
    settingsTarget,
  );
};

export default GuandanPatternSettings;
