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
        return {
          id: button.dataset.selectedPreviewId,
          html: button.innerHTML,
        };
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
      .guandan-level-hud {
        order: -100;
        display: flex;
        align-items: stretch;
        gap: 8px;
        padding: 0 !important;
        background: transparent !important;
      }
      .guandan-level-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 42px;
        padding: 5px 10px 5px 12px;
        border: 2px solid #e2b54b;
        border-radius: 12px;
        background: linear-gradient(180deg, #fff5cf, #efc966);
        color: #713a08;
        box-shadow: 0 3px 0 #8e631c, 0 5px 10px rgb(0 0 0 / 24%);
        white-space: nowrap;
      }
      .guandan-level-badge span {
        font-size: .9rem;
        font-weight: 900;
      }
      .guandan-level-badge strong {
        display: grid;
        min-width: 34px;
        height: 32px;
        place-items: center;
        padding: 0 5px;
        border-radius: 8px;
        background: #fffaf0;
        color: #b44013;
        font-size: 1.35rem;
        line-height: 1;
      }
      .guandan-level-badge small {
        font-size: .78rem;
        font-weight: 900;
      }

      .guandan-private-zone {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) 230px;
        grid-template-rows: auto minmax(0, 1fr);
        column-gap: 12px;
        align-items: stretch;
      }
      .guandan-private-zone > .guandan-zone-title {
        grid-column: 1 / -1;
        grid-row: 1;
      }
      .guandan-private-zone > .guandan-hand-section {
        grid-column: 1;
        grid-row: 2;
        min-width: 0;
        position: relative !important;
        z-index: 1 !important;
        pointer-events: auto !important;
      }
      .guandan-private-zone .guandan-hand,
      .guandan-private-zone .guandan-hand .guandan-card-stack,
      .guandan-private-zone .guandan-hand .guandan-card-stack > button {
        pointer-events: auto !important;
      }
      .guandan-private-zone > .guandan-play-actions {
        grid-column: 2;
        grid-row: 2;
        position: relative !important;
        inset: auto !important;
        z-index: 2 !important;
        display: flex !important;
        flex-direction: column;
        align-items: stretch !important;
        justify-content: flex-end !important;
        gap: 12px !important;
        min-width: 0;
        margin: 0 !important;
        padding: 12px 10px !important;
        border-left: 3px solid #c99a2b;
        border-radius: 12px 0 0 12px;
        background: linear-gradient(180deg, #fffdf4 0%, #f5e8b8 100%);
      }
      .guandan-selected-preview {
        order: -100;
        display: flex;
        flex: 1 1 auto;
        min-height: 210px;
        flex-direction: column;
        padding: 8px 8px 10px;
        border: 2px solid #d5ad45;
        border-radius: 13px;
        background: #fffaf0;
      }
      .guandan-selected-preview-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        color: #65410b;
        text-align: center;
        font-weight: 900;
      }
      .guandan-selected-preview-header small {
        color: #7a6333;
        font-size: .74rem;
        font-weight: 700;
        line-height: 1.3;
      }
      .guandan-selected-preview-cards {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        min-height: 120px;
        overflow-y: auto;
        padding: 10px 2px 4px;
      }
      .guandan-selected-preview-card {
        width: 84px;
        min-width: 84px;
        height: 118px;
        margin-top: -72px;
        padding: 0;
        overflow: hidden;
        border: 2px solid #fff1a8;
        border-radius: 9px;
        background: transparent;
        box-shadow: 0 3px 7px rgb(0 0 0 / 28%);
        cursor: pointer;
      }
      .guandan-selected-preview-card:first-child {
        margin-top: 0;
      }
      .guandan-selected-preview-card > * {
        width: 100% !important;
        height: 100% !important;
      }
      .guandan-selected-preview-empty {
        display: grid;
        flex: 1 1 auto;
        min-height: 130px;
        place-items: center;
        color: #87744e;
        text-align: center;
        font-weight: 800;
        line-height: 1.4;
      }
      .guandan-private-zone > .guandan-play-actions > button {
        width: 100% !important;
        min-width: 0 !important;
        min-height: 58px !important;
        padding: 12px 14px !important;
        border-width: 2px !important;
        border-radius: 15px !important;
        font-size: 1.3rem !important;
        font-weight: 950 !important;
        letter-spacing: .08em;
      }
      .guandan-private-zone > .guandan-play-actions > button:nth-last-of-type(2) {
        border-color: #ffe08a !important;
        background: linear-gradient(180deg, #ffdf64, #e7a92b) !important;
        color: #4b2b00 !important;
      }
      .guandan-private-zone > .guandan-play-actions > button:last-of-type {
        border-color: #f1c9bb !important;
        background: linear-gradient(180deg, #d9997f, #b86750) !important;
        color: #fff !important;
      }

      @media (max-width: 760px) {
        .guandan-private-zone {
          grid-template-columns: minmax(0, 1fr) 150px;
          column-gap: 6px;
        }
        .guandan-private-zone > .guandan-play-actions {
          padding: 8px 6px !important;
          gap: 8px !important;
        }
        .guandan-selected-preview {
          min-height: 180px;
          padding: 6px;
        }
        .guandan-selected-preview-header strong {
          font-size: .86rem;
        }
        .guandan-selected-preview-header small {
          font-size: .66rem;
        }
        .guandan-selected-preview-card {
          width: 66px;
          min-width: 66px;
          height: 94px;
          margin-top: -56px;
        }
        .guandan-private-zone > .guandan-play-actions > button {
          min-height: 54px !important;
          padding: 10px 8px !important;
          font-size: 1.12rem !important;
        }
      }
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
            <div className="guandan-level-badge">
              <span>当前级牌</span>
              <strong>{currentLevel}</strong>
              <small>级牌</small>
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
              <strong>已选待出（{selectedPreviewCards.length} 张）</strong>
              <small>核对无误后再点“出牌”；点牌可取消</small>
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
                已选牌将在这里显示
              </div>
            )}
          </div>,
          playActionsTarget,
        )}
    </>
  );
};

export default GuandanCustomSortControls;
