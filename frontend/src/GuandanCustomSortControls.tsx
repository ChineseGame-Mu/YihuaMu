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
  const [handSectionTarget, setHandSectionTarget] =
    React.useState<HTMLElement | null>(null);
  const [selectedPreviewCards, setSelectedPreviewCards] = React.useState<
    SelectedPreviewCard[]
  >([]);

  const nextIdRef = React.useRef(1);
  const previewIdRef = React.useRef(1);
  const orderRef = React.useRef<string[]>([]);
  const organizedRef = React.useRef(false);

  const ensureStackIds = React.useCallback((): HTMLElement[] => {
    const stacks = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".guandan-hand .guandan-card-stack",
      ),
    );

    for (const [index, stack] of stacks.entries()) {
      if (!stack.dataset.oneClickSortId) {
        stack.dataset.oneClickSortId = `one-click-stack-${nextIdRef.current++}`;
      }
      if (!stack.dataset.naturalOrder) {
        stack.dataset.naturalOrder = String(index);
      }
      stack.draggable = false;
      stack.style.cursor = "";
      stack.style.display = "";
    }

    const liveIds = stacks.map((stack) => stack.dataset.oneClickSortId!);
    orderRef.current = [
      ...orderRef.current.filter((id) => liveIds.includes(id)),
      ...liveIds.filter((id) => !orderRef.current.includes(id)),
    ];

    return stacks;
  }, []);

  const applyOrder = React.useCallback(() => {
    const stacks = ensureStackIds();
    if (!organizedRef.current) {
      for (const stack of stacks) stack.style.order = "";
      return;
    }

    const positions = new Map(orderRef.current.map((id, index) => [id, index]));
    for (const stack of stacks) {
      const id = stack.dataset.oneClickSortId!;
      stack.style.order = String(positions.get(id) ?? 0);
    }
  }, [ensureStackIds]);

  const organizeHand = React.useCallback(() => {
    const stacks = ensureStackIds();
    if (stacks.length === 0) return;

    const groupPriority = (count: number): number => {
      if (count >= 4) return 0;
      if (count === 3) return 1;
      if (count === 2) return 2;
      return 3;
    };

    const arranged = [...stacks].sort((a, b) => {
      const aCount = a.querySelectorAll(":scope > button").length;
      const bCount = b.querySelectorAll(":scope > button").length;
      const priorityDifference = groupPriority(aCount) - groupPriority(bCount);
      if (priorityDifference !== 0) return priorityDifference;
      if (aCount !== bCount) return bCount - aCount;
      return (
        Number(a.dataset.naturalOrder ?? 0) -
        Number(b.dataset.naturalOrder ?? 0)
      );
    });

    orderRef.current = arranged.map((stack) => stack.dataset.oneClickSortId!);
    organizedRef.current = true;
    applyOrder();
  }, [applyOrder, ensureStackIds]);

  const refreshSelectedPreview = React.useCallback(() => {
    const selectedButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '.guandan-hand .guandan-card-stack > button[aria-pressed="true"]',
      ),
    );

    const cards = selectedButtons.map((button) => {
      if (!button.dataset.selectedPreviewId) {
        button.dataset.selectedPreviewId = `selected-preview-${previewIdRef.current++}`;
      }
      return {
        id: button.dataset.selectedPreviewId,
        html: button.innerHTML,
      };
    });
    setSelectedPreviewCards(cards);
  }, []);

  const deselectPreviewCard = React.useCallback((id: string) => {
    const button = document.querySelector<HTMLButtonElement>(
      `.guandan-hand .guandan-card-stack > button[data-selected-preview-id="${id}"]`,
    );
    button?.click();
  }, []);

  React.useEffect(() => {
    window.localStorage.removeItem("guandan_custom_hand_sort_enabled");
    window.localStorage.removeItem("guandan_custom_stack_mode_enabled");
  }, []);

  React.useEffect(() => {
    const refresh = () => {
      setPlayActionsTarget(
        document.querySelector<HTMLElement>(".guandan-play-actions"),
      );
      setStatusBarTarget(
        document.querySelector<HTMLElement>(".guandan-status-bar"),
      );
      setHandSectionTarget(
        document.querySelector<HTMLElement>(".guandan-hand-section"),
      );
      applyOrder();
      refreshSelectedPreview();
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-pressed"],
    });
    return () => observer.disconnect();
  }, [applyOrder, refreshSelectedPreview]);

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
        box-shadow: inset 0 0 0 1px rgb(152 92 13 / 24%);
      }
      .guandan-level-badge small {
        font-size: .78rem;
        font-weight: 900;
      }
      .guandan-selected-preview {
        margin: 10px 8px 2px;
        padding: 9px 12px 12px;
        border: 2px solid #ddb851;
        border-radius: 14px;
        background: linear-gradient(180deg, #fffdf1, #f5e9bd);
        box-shadow: inset 0 1px 0 #fff, 0 3px 8px rgb(0 0 0 / 16%);
      }
      .guandan-selected-preview-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 7px;
        color: #65410b;
        font-weight: 900;
      }
      .guandan-selected-preview-header small {
        color: #725b2e;
        font-weight: 700;
      }
      .guandan-selected-preview-cards {
        display: flex;
        align-items: flex-end;
        justify-content: center;
        min-height: 78px;
        overflow-x: auto;
        padding: 4px 6px 2px;
      }
      .guandan-selected-preview-card {
        width: 58px;
        min-width: 58px;
        height: 82px;
        margin-left: -13px;
        padding: 0;
        overflow: hidden;
        border: 2px solid #fff7c7;
        border-radius: 8px;
        background: transparent;
        box-shadow: 0 3px 7px rgb(0 0 0 / 28%);
        cursor: pointer;
      }
      .guandan-selected-preview-card:first-child {
        margin-left: 0;
      }
      .guandan-selected-preview-card > * {
        width: 100% !important;
        height: 100% !important;
      }
      .guandan-selected-preview-empty {
        display: grid;
        min-height: 58px;
        place-items: center;
        color: #7a6b4a;
        font-weight: 800;
      }
      .guandan-play-actions {
        gap: 18px !important;
        align-items: center;
        justify-content: center;
      }
      .guandan-one-click-sort {
        order: -1;
        min-width: 126px !important;
        min-height: 54px !important;
        padding: 11px 20px !important;
        border: 2px solid #c9ffd6 !important;
        border-radius: 16px !important;
        background: linear-gradient(180deg, #35d36f, #159447) !important;
        color: #fff !important;
        font-size: 1.16rem !important;
        font-weight: 950 !important;
        letter-spacing: .06em;
        box-shadow: 0 5px 0 #0a662f, 0 8px 15px rgb(0 0 0 / 22%) !important;
      }
      .guandan-play-actions > button:last-of-type,
      .guandan-play-actions > button:nth-last-of-type(2) {
        min-width: 142px;
        min-height: 62px;
        padding: 13px 28px !important;
        border-width: 2px !important;
        border-radius: 17px !important;
        font-size: 1.35rem !important;
        font-weight: 950 !important;
        letter-spacing: .08em;
        box-shadow: 0 5px 0 #8b681d, 0 8px 16px rgb(0 0 0 / 24%) !important;
      }
      .guandan-play-actions > button:nth-last-of-type(2) {
        border-color: #ffe08a !important;
        background: linear-gradient(180deg, #ffdf64, #e7a92b) !important;
        color: #4b2b00 !important;
      }
      .guandan-play-actions > button:last-of-type {
        border-color: #d8efe3 !important;
        background: linear-gradient(180deg, #f6fff9, #cde8d7) !important;
        color: #175336 !important;
      }
      @media (max-width: 760px) {
        .guandan-level-hud {
          width: 100%;
          gap: 6px;
        }
        .guandan-level-badge {
          flex: 1 1 0;
          min-height: 38px;
          padding: 4px 8px;
          justify-content: center;
        }
        .guandan-level-badge span {
          font-size: .8rem;
        }
        .guandan-level-badge strong {
          min-width: 30px;
          height: 29px;
          font-size: 1.18rem;
        }
        .guandan-selected-preview {
          margin: 8px 4px 2px;
          padding: 8px;
        }
        .guandan-selected-preview-card {
          width: 52px;
          min-width: 52px;
          height: 74px;
          margin-left: -11px;
        }
        .guandan-one-click-sort {
          min-width: 112px !important;
          min-height: 52px !important;
          padding: 10px 16px !important;
          font-size: 1.08rem !important;
        }
        .guandan-play-actions > button:last-of-type,
        .guandan-play-actions > button:nth-last-of-type(2) {
          min-width: 132px;
          min-height: 60px;
          padding: 12px 22px !important;
          font-size: 1.25rem !important;
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
      {handSectionTarget &&
        createPortal(
          <div
            className="guandan-selected-preview"
            aria-label="已选待出牌核对区"
          >
            <div className="guandan-selected-preview-header">
              <strong>已选待出（{selectedPreviewCards.length} 张）</strong>
              <small>请核对无误后再点“出牌”；点这里的牌可取消选择</small>
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
                请先从手牌中选择准备出的牌
              </div>
            )}
          </div>,
          handSectionTarget,
        )}
      {playActionsTarget &&
        createPortal(
          <button
            type="button"
            className="guandan-one-click-sort"
            onClick={organizeHand}
            title="自动把炸弹、三张、对子和单张分类排列"
          >
            一键理牌
          </button>,
          playActionsTarget,
        )}
    </>
  );
};

export default GuandanCustomSortControls;
