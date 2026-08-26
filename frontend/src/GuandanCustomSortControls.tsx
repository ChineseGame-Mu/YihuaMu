import * as React from "react";
import { createPortal } from "react-dom";

import { GuandanStateContext } from "./GuandanStateProvider";

const levelLabel: Record<string, string> = {
  Two: "2",
  Three: "3",
  Four: "4",
  Five: "5",
  Six: "6",
  Seven: "7",
  Eight: "8",
  Nine: "9",
  Ten: "10",
  Jack: "J",
  Queen: "Q",
  King: "K",
  Ace: "A",
};

type SelectedPreviewCard = {
  id: string;
  html: string;
};

const GuandanCustomSortControls: React.FunctionComponent = () => {
  const { state } = React.useContext(GuandanStateContext);
  const [playActionsTarget, setPlayActionsTarget] =
    React.useState<HTMLElement | null>(null);
  const [statusBarTarget, setStatusBarTarget] =
    React.useState<HTMLElement | null>(null);
  const [selectedPreviewCards, setSelectedPreviewCards] = React.useState<
    SelectedPreviewCard[]
  >([]);
  const previewIdRef = React.useRef(1);

  const refreshSelectedPreview = React.useCallback(() => {
    const selectedButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '.guandan-hand .guandan-card-stack > button[aria-pressed="true"]',
      ),
    );

    setSelectedPreviewCards(
      selectedButtons.map((button) => {
        if (!button.dataset.selectedPreviewId) {
          button.dataset.selectedPreviewId = `selected-preview-${previewIdRef.current++}`;
        }
        return { id: button.dataset.selectedPreviewId, html: button.innerHTML };
      }),
    );
  }, []);

  const deselectPreviewCard = React.useCallback((id: string) => {
    const button = document.querySelector<HTMLButtonElement>(
      `.guandan-hand .guandan-card-stack > button[data-selected-preview-id="${id}"]`,
    );
    button?.click();
  }, []);

  React.useEffect(() => {
    const refreshTargets = () => {
      setPlayActionsTarget(
        document.querySelector<HTMLElement>(".guandan-play-actions"),
      );
      setStatusBarTarget(
        document.querySelector<HTMLElement>(".guandan-status-bar"),
      );
    };

    refreshTargets();
    const observer = new MutationObserver(refreshTargets);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const hand = document.querySelector<HTMLElement>(".guandan-hand");
    refreshSelectedPreview();
    if (hand === null) return;

    const observer = new MutationObserver(refreshSelectedPreview);
    observer.observe(hand, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-pressed"],
    });
    return () => observer.disconnect();
  }, [playActionsTarget, refreshSelectedPreview]);

  const currentLevel =
    state.level === null ? "—" : (levelLabel[state.level] ?? state.level);

  const globalStyles = (
    <style>{`
      .guandan-level-hud{order:-100;display:flex;align-items:stretch;gap:8px;padding:0!important;background:transparent!important}
      .guandan-level-badge{display:flex;align-items:center;gap:8px;min-height:42px;padding:5px 10px 5px 12px;border:2px solid #e2b54b;border-radius:12px;background:linear-gradient(180deg,#fff5cf,#efc966);color:#713a08;box-shadow:0 3px 0 #8e631c,0 5px 10px rgb(0 0 0 / 24%);white-space:nowrap}
      .guandan-level-badge span{font-size:.9rem;font-weight:900}.guandan-level-badge strong{display:grid;min-width:34px;height:32px;place-items:center;padding:0 5px;border-radius:8px;background:#fffaf0;color:#b44013;font-size:1.35rem;line-height:1}.guandan-level-badge small{font-size:.78rem;font-weight:900}

      .guandan-private-zone{display:grid!important;grid-template-columns:minmax(0,2fr) minmax(320px,1fr)!important;grid-template-rows:auto minmax(0,1fr)!important;column-gap:0!important;align-items:stretch!important}
      .guandan-private-zone>.guandan-zone-title{grid-column:1/-1!important;grid-row:1!important}
      .guandan-private-zone>.guandan-hand-section{grid-column:1!important;grid-row:2!important;width:auto!important;min-width:0!important;height:auto!important;padding:5px 7px!important;margin:0!important;position:relative!important;z-index:1!important;pointer-events:auto!important;border-radius:14px 0 0 14px!important}
      .guandan-private-zone .guandan-hand,.guandan-private-zone .guandan-hand .guandan-card-stack,.guandan-private-zone .guandan-hand .guandan-card-stack>button{pointer-events:auto!important}
      .guandan-private-zone>.guandan-play-actions{grid-column:2!important;grid-row:2!important;position:relative!important;inset:auto!important;top:auto!important;right:auto!important;bottom:auto!important;left:auto!important;width:auto!important;min-width:0!important;max-width:none!important;height:auto!important;margin:0!important;padding:76px 14px 14px!important;display:block!important;overflow:hidden!important;border:0!important;border-left:3px solid #d4a52f!important;border-radius:0 0 14px 0!important;background:linear-gradient(180deg,#fffef6 0%,#fff4cf 100%)!important;box-shadow:none!important;backdrop-filter:none!important}
      .guandan-private-zone>.guandan-play-actions:before{content:"待出牌核对区";position:absolute;top:10px;left:0;right:0;text-align:center;color:#6a4704;font-size:1.05rem;font-weight:950}
      .guandan-private-zone>.guandan-play-actions>button{position:absolute!important;top:36px!important;width:calc(50% - 21px)!important;min-width:0!important;max-width:none!important;height:48px!important;min-height:48px!important;max-height:48px!important;padding:0 10px!important;border-width:2px!important;border-radius:12px!important;font-size:1.12rem!important;font-weight:950!important;letter-spacing:.08em!important;opacity:1!important}
      .guandan-private-zone>.guandan-play-actions>button:nth-last-of-type(2){left:14px!important;right:auto!important;border-color:#fff0a5!important;background:linear-gradient(180deg,#ffe16a 0%,#ffb313 100%)!important;color:#4b2b00!important;box-shadow:0 3px 0 #a66b00,0 4px 8px rgb(0 0 0 / 18%)!important}
      .guandan-private-zone>.guandan-play-actions>button:last-of-type{left:auto!important;right:14px!important;border-color:#d9f5ff!important;background:linear-gradient(180deg,#7ee2ff 0%,#23b9ef 100%)!important;color:#073d5a!important;box-shadow:0 3px 0 #086a9d,0 4px 8px rgb(0 0 0 / 18%)!important}
      .guandan-private-zone>.guandan-play-actions>button:disabled{opacity:.55!important;filter:saturate(.72)!important}

      .guandan-selected-preview{position:relative!important;display:flex!important;flex-direction:column!important;height:100%!important;min-height:0!important;padding:18px 12px 12px!important;border:2px dashed #d9b75b!important;border-radius:14px!important;background:rgba(255,255,255,.24)!important;box-shadow:none!important}
      .guandan-selected-preview-header{display:flex;flex-direction:column;align-items:center;gap:5px;color:#5f3d08;text-align:center;font-weight:950}.guandan-selected-preview-header strong{font-size:1.06rem}.guandan-selected-preview-header small{color:#725a29;font-size:.78rem;font-weight:750;line-height:1.35}
      .guandan-selected-preview-cards{display:flex;flex:1 1 auto;flex-direction:column;align-items:center;justify-content:flex-start;min-height:0;overflow-y:auto;padding:14px 2px 6px}.guandan-selected-preview-card{width:96px;min-width:96px;height:134px;margin-top:-80px;padding:0;overflow:hidden;border:3px solid #ffe68a;border-radius:10px;background:transparent;box-shadow:0 4px 9px rgb(0 0 0 / 30%);cursor:pointer}.guandan-selected-preview-card:first-child{margin-top:0}.guandan-selected-preview-card>*{width:100%!important;height:100%!important}.guandan-selected-preview-empty{display:grid;flex:1 1 auto;min-height:220px;place-items:center;color:#7c6942;text-align:center;font-weight:850;line-height:1.5}

      @media(max-width:900px){.guandan-private-zone{grid-template-columns:minmax(0,2fr) minmax(240px,1fr)!important}.guandan-private-zone>.guandan-play-actions{padding:72px 8px 8px!important}.guandan-private-zone>.guandan-play-actions>button{width:calc(50% - 12px)!important;height:42px!important;min-height:42px!important;max-height:42px!important;font-size:.98rem!important}.guandan-private-zone>.guandan-play-actions>button:nth-last-of-type(2){left:8px!important}.guandan-private-zone>.guandan-play-actions>button:last-of-type{right:8px!important}.guandan-selected-preview-card{width:72px;min-width:72px;height:102px;margin-top:-60px}}
    `}</style>
  );

  return (
    <>
      {globalStyles}
      {statusBarTarget &&
        createPortal(
          <div className="guandan-level-hud" aria-label="本局级牌信息">
            <div className="guandan-level-badge">
              <span>本局打</span>
              <strong>{currentLevel}</strong>
            </div>
          </div>,
          statusBarTarget,
        )}
      {playActionsTarget &&
        createPortal(
          <div
            className="guandan-selected-preview"
            aria-label="已选待出牌核对区"
          >
            <div className="guandan-selected-preview-header">
              <strong>待出牌核对区（{selectedPreviewCards.length} 张）</strong>
              <small>请核对无误后再点“出牌”；点牌可取消</small>
            </div>
            {selectedPreviewCards.length > 0 ? (
              <div className="guandan-selected-preview-cards">
                {selectedPreviewCards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    className="guandan-selected-preview-card"
                    aria-label="取消这张待出牌"
                    title="点击取消选择"
                    onClick={() => deselectPreviewCard(card.id)}
                    dangerouslySetInnerHTML={{ __html: card.html }}
                  />
                ))}
              </div>
            ) : (
              <div className="guandan-selected-preview-empty">
                请先选牌，确认后再出牌
              </div>
            )}
          </div>,
          playActionsTarget,
        )}
    </>
  );
};

export default GuandanCustomSortControls;
