import * as React from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "guandan_custom_hand_sort_enabled";
const CUSTOM_STACK_KEY = "guandan_custom_stack_mode_enabled";

const GuandanCustomSortControls: React.FunctionComponent = () => {
  const [enabled, setEnabled] = React.useState(
    () => window.localStorage.getItem(STORAGE_KEY) === "on",
  );
  const [customStackMode, setCustomStackMode] = React.useState(
    () => window.localStorage.getItem(CUSTOM_STACK_KEY) === "on",
  );
  const [settingsTarget, setSettingsTarget] =
    React.useState<HTMLElement | null>(null);
  const [privateZoneTarget, setPrivateZoneTarget] =
    React.useState<HTMLElement | null>(null);

  const orderRef = React.useRef<string[]>([]);
  const nextIdRef = React.useRef(1);
  const draggedStackIdRef = React.useRef<string | null>(null);
  const draggedCardIdRef = React.useRef<string | null>(null);
  const cardOrderRef = React.useRef<string[]>([]);
  const cardGroupsRef = React.useRef<Map<string, string>>(new Map());
  const nextGroupIdRef = React.useRef(1);
  const bulkClickRef = React.useRef(false);
  const customStackModeRef = React.useRef(customStackMode);

  React.useEffect(() => {
    customStackModeRef.current = customStackMode;
  }, [customStackMode]);

  const ensureCardIds = React.useCallback((): HTMLButtonElement[] => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        ".guandan-hand .guandan-card-stack > button",
      ),
    );
    for (const button of buttons) {
      if (!button.dataset.customCardId) {
        button.dataset.customCardId = `custom-card-${nextIdRef.current++}`;
      }
    }
    const liveIds = buttons.map((button) => button.dataset.customCardId!);
    cardOrderRef.current = [
      ...cardOrderRef.current.filter((id) => liveIds.includes(id)),
      ...liveIds.filter((id) => !cardOrderRef.current.includes(id)),
    ];
    for (const id of Array.from(cardGroupsRef.current.keys())) {
      if (!liveIds.includes(id)) cardGroupsRef.current.delete(id);
    }
    return buttons;
  }, []);

  const normalizeGroups = React.useCallback(() => {
    const counts = new Map<string, number>();
    for (const group of Array.from(cardGroupsRef.current.values())) {
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    for (const [id, group] of Array.from(cardGroupsRef.current.entries())) {
      if ((counts.get(group) ?? 0) < 2) cardGroupsRef.current.delete(id);
    }
  }, []);

  const applyCardGroups = React.useCallback(() => {
    const hand = document.querySelector<HTMLElement>(".guandan-hand");
    const buttons = ensureCardIds();
    if (!hand) return;

    hand.classList.toggle("guandan-custom-stack-mode", customStackMode);
    const position = new Map(
      cardOrderRef.current.map((id, index) => [id, index]),
    );
    const buttonsById = new Map(
      buttons.map((button) => [button.dataset.customCardId!, button]),
    );

    for (const button of buttons) {
      const id = button.dataset.customCardId!;
      button.draggable = customStackMode;
      button.style.order = customStackMode ? String(position.get(id) ?? 0) : "";
      button.style.cursor = customStackMode ? "grab" : "";
      button.classList.remove("guandan-custom-stack-member");
      button.style.marginLeft = "";
    }

    if (!customStackMode) return;

    for (let index = 0; index < cardOrderRef.current.length; index += 1) {
      const id = cardOrderRef.current[index]!;
      const button = buttonsById.get(id);
      if (!button) continue;
      const group = cardGroupsRef.current.get(id);
      if (!group) continue;
      button.classList.add("guandan-custom-stack-member");
      const previousId = cardOrderRef.current[index - 1];
      if (previousId && cardGroupsRef.current.get(previousId) === group) {
        button.style.marginLeft = "-58px";
      }
    }
  }, [customStackMode, ensureCardIds]);

  const stackCardOnto = React.useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      const sourceIndex = cardOrderRef.current.indexOf(sourceId);
      const targetIndex = cardOrderRef.current.indexOf(targetId);
      if (sourceIndex < 0 || targetIndex < 0) return;

      const targetGroup =
        cardGroupsRef.current.get(targetId) ??
        `custom-group-${nextGroupIdRef.current++}`;
      cardGroupsRef.current.delete(sourceId);
      cardGroupsRef.current.set(targetId, targetGroup);
      cardGroupsRef.current.set(sourceId, targetGroup);
      normalizeGroups();

      const withoutSource = cardOrderRef.current.filter(
        (id) => id !== sourceId,
      );
      let insertAfter = withoutSource.indexOf(targetId);
      while (
        insertAfter + 1 < withoutSource.length &&
        cardGroupsRef.current.get(withoutSource[insertAfter + 1]!) ===
          targetGroup
      ) {
        insertAfter += 1;
      }
      withoutSource.splice(insertAfter + 1, 0, sourceId);
      cardOrderRef.current = withoutSource;
      applyCardGroups();
    },
    [applyCardGroups, normalizeGroups],
  );

  const ensureStackIds = React.useCallback((): HTMLElement[] => {
    const stacks = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".guandan-hand .guandan-card-stack",
      ),
    );
    for (const stack of stacks) {
      if (!stack.dataset.customSortId) {
        stack.dataset.customSortId = `custom-stack-${nextIdRef.current++}`;
      }
    }
    const liveIds = stacks.map((stack) => stack.dataset.customSortId!);
    orderRef.current = [
      ...orderRef.current.filter((id) => liveIds.includes(id)),
      ...liveIds.filter((id) => !orderRef.current.includes(id)),
    ];
    return stacks;
  }, []);

  const applyOrder = React.useCallback(() => {
    const stacks = ensureStackIds();
    const positions = new Map(orderRef.current.map((id, index) => [id, index]));
    for (const stack of stacks) {
      const id = stack.dataset.customSortId!;
      stack.style.order =
        enabled && !customStackMode ? String(positions.get(id) ?? 0) : "";
      stack.draggable = enabled && !customStackMode;
      stack.style.cursor = enabled && !customStackMode ? "grab" : "";
      if (stack.dataset.customSortBound !== "1") {
        stack.dataset.customSortBound = "1";
        stack.addEventListener("dragstart", (event) => {
          if (customStackModeRef.current) {
            event.preventDefault();
            return;
          }
          draggedStackIdRef.current = stack.dataset.customSortId ?? null;
        });
        stack.addEventListener("dragover", (event) => {
          if (!customStackModeRef.current) event.preventDefault();
        });
        stack.addEventListener("drop", (event) => {
          if (customStackModeRef.current) return;
          event.preventDefault();
          const from = draggedStackIdRef.current;
          const to = stack.dataset.customSortId;
          if (!from || !to || from === to) return;
          const order = [...orderRef.current];
          const fromIndex = order.indexOf(from);
          const toIndex = order.indexOf(to);
          if (fromIndex < 0 || toIndex < 0) return;
          order.splice(fromIndex, 1);
          order.splice(toIndex, 0, from);
          orderRef.current = order;
          applyOrder();
        });
        stack.addEventListener("dragend", () => {
          draggedStackIdRef.current = null;
        });
      }
    }
    applyCardGroups();
  }, [applyCardGroups, customStackMode, enabled, ensureStackIds]);

  const bindCardEvents = React.useCallback(() => {
    const hand = document.querySelector<HTMLElement>(".guandan-hand");
    const buttons = ensureCardIds();
    if (!hand) return;

    for (const button of buttons) {
      if (button.dataset.customStackBound === "1") continue;
      button.dataset.customStackBound = "1";
      button.addEventListener("dragstart", (event) => {
        if (!customStackModeRef.current) return;
        event.stopPropagation();
        const id = button.dataset.customCardId ?? null;
        draggedCardIdRef.current = id;
        if (event.dataTransfer && id) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", id);
        }
      });
      button.addEventListener("dragover", (event) => {
        if (!customStackModeRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      });
      button.addEventListener("drop", (event) => {
        if (!customStackModeRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        const source = draggedCardIdRef.current;
        const target = button.dataset.customCardId;
        if (source && target) stackCardOnto(source, target);
      });
      button.addEventListener("dragend", (event) => {
        if (customStackModeRef.current) event.stopPropagation();
        draggedCardIdRef.current = null;
      });
    }

    if (hand.dataset.customStackClickBound !== "1") {
      hand.dataset.customStackClickBound = "1";
      hand.addEventListener(
        "click",
        (event) => {
          if (!customStackModeRef.current || bulkClickRef.current) return;
          const target = (
            event.target as HTMLElement | null
          )?.closest<HTMLButtonElement>(".guandan-card-stack > button");
          if (!target) return;
          const id = target.dataset.customCardId;
          const group = id ? cardGroupsRef.current.get(id) : undefined;
          if (!group) return;
          const members = Array.from(
            document.querySelectorAll<HTMLButtonElement>(
              ".guandan-hand .guandan-card-stack > button",
            ),
          ).filter(
            (button) =>
              cardGroupsRef.current.get(button.dataset.customCardId ?? "") ===
              group,
          );
          if (members.length < 2) return;
          event.preventDefault();
          event.stopPropagation();
          bulkClickRef.current = true;
          try {
            for (const member of members) member.click();
          } finally {
            bulkClickRef.current = false;
          }
        },
        true,
      );
    }
  }, [ensureCardIds, stackCardOnto]);

  const moveSelected = React.useCallback(
    (side: "left" | "right") => {
      const stacks = ensureStackIds();
      const selectedIds = stacks
        .filter((stack) => stack.querySelector('[aria-pressed="true"]'))
        .map((stack) => stack.dataset.customSortId!);
      if (selectedIds.length === 0) return;
      const selectedSet = new Set(selectedIds);
      const picked = orderRef.current.filter((id) => selectedSet.has(id));
      const rest = orderRef.current.filter((id) => !selectedSet.has(id));
      orderRef.current =
        side === "left" ? [...picked, ...rest] : [...rest, ...picked];
      applyOrder();
    },
    [applyOrder, ensureStackIds],
  );

  const resetOrder = React.useCallback(() => {
    orderRef.current = [];
    const stacks = ensureStackIds();
    orderRef.current = stacks.map((stack) => stack.dataset.customSortId!);
    applyOrder();
  }, [applyOrder, ensureStackIds]);

  const splitSelectedStack = React.useCallback(() => {
    const selectedButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '.guandan-hand .guandan-card-stack > button[aria-pressed="true"]',
      ),
    );
    for (const button of selectedButtons) {
      const id = button.dataset.customCardId;
      if (id) cardGroupsRef.current.delete(id);
    }
    normalizeGroups();
    applyCardGroups();
  }, [applyCardGroups, normalizeGroups]);

  const toggleCustomStackMode = React.useCallback(() => {
    setCustomStackMode((current) => {
      const next = !current;
      if (!next) {
        cardGroupsRef.current.clear();
        cardOrderRef.current = [];
      }
      return next;
    });
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    applyOrder();
  }, [enabled, applyOrder]);

  React.useEffect(() => {
    window.localStorage.setItem(
      CUSTOM_STACK_KEY,
      customStackMode ? "on" : "off",
    );
    applyOrder();
  }, [customStackMode, applyOrder]);

  React.useEffect(() => {
    const refresh = () => {
      setSettingsTarget(
        document.querySelector<HTMLElement>(".guandan-settings"),
      );
      setPrivateZoneTarget(
        document.querySelector<HTMLElement>(".guandan-private-zone"),
      );
      bindCardEvents();
      applyOrder();
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [applyOrder, bindCardEvents]);

  const globalStyles = (
    <style>{`
      .guandan-stack-mode-controls {
        position: absolute;
        top: 5px;
        right: 16px;
        z-index: 8;
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .guandan-stack-mode-button {
        padding: 7px 13px !important;
        border: 2px solid #f4d47c !important;
        border-radius: 10px !important;
        background: linear-gradient(180deg, #fff5c8, #e8bd58) !important;
        color: #543500 !important;
        font-size: .9rem !important;
        font-weight: 900 !important;
        box-shadow: 0 3px 7px rgb(0 0 0 / 28%) !important;
      }
      .guandan-stack-mode-button.is-on {
        border-color: #8ee7ff !important;
        background: linear-gradient(180deg, #1ca9c6, #08758c) !important;
        color: white !important;
      }
      .guandan-stack-split-button {
        padding: 7px 10px !important;
        font-size: .82rem !important;
      }
      .guandan-hand.guandan-custom-stack-mode .guandan-card-stack {
        display: contents;
      }
      .guandan-hand.guandan-custom-stack-mode .guandan-card-stack > button {
        flex: 0 0 78px;
        margin: 0 !important;
      }
      .guandan-hand.guandan-custom-stack-mode .guandan-card-stack > button.guandan-custom-stack-member {
        box-shadow: 0 4px 9px rgb(0 0 0 / 34%);
      }
      .guandan-hand.guandan-custom-stack-mode .guandan-card-stack > button.guandan-custom-stack-member + button.guandan-custom-stack-member {
        position: relative;
      }
      .guandan-play-actions {
        gap: 18px !important;
        align-items: center;
        justify-content: center;
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
        .guandan-stack-mode-controls {
          position: static;
          justify-content: center;
          margin: -2px 0 8px;
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
      {settingsTarget &&
        createPortal(
          <div className="guandan-custom-sort-setting">
            <hr />
            <label>
              <input
                type="checkbox"
                checked={enabled}
                disabled={customStackMode}
                onChange={(event) => setEnabled(event.target.checked)}
              />{" "}
              玩家自由组合牌排序
            </label>
            <p>
              数字自动叠加模式下，可拖动同数字牌组调整位置；切换到自定义叠牌后，改为逐张拖牌叠组。
            </p>
            {enabled && !customStackMode && (
              <div className="guandan-actions" aria-label="自由组合牌排序操作">
                <button
                  type="button"
                  className="normal"
                  onClick={() => moveSelected("left")}
                >
                  所选牌移到左侧
                </button>
                <button
                  type="button"
                  className="normal"
                  onClick={() => moveSelected("right")}
                >
                  所选牌移到右侧
                </button>
                <button type="button" className="normal" onClick={resetOrder}>
                  重置自由排序
                </button>
              </div>
            )}
          </div>,
          settingsTarget,
        )}
      {privateZoneTarget &&
        createPortal(
          <div
            className="guandan-stack-mode-controls"
            aria-label="叠牌模式转换"
          >
            <button
              type="button"
              className={`guandan-stack-mode-button ${customStackMode ? "is-on" : ""}`}
              aria-pressed={customStackMode}
              onClick={toggleCustomStackMode}
              title="切换数字自动叠加与玩家自定义叠牌"
            >
              自定义叠牌：{customStackMode ? "开" : "关"}
            </button>
            {customStackMode && (
              <button
                type="button"
                className="normal guandan-stack-split-button"
                onClick={splitSelectedStack}
              >
                拆开所选
              </button>
            )}
          </div>,
          privateZoneTarget,
        )}
    </>
  );
};

export default GuandanCustomSortControls;
